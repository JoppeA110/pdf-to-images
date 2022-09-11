const fs = require('fs').promises;
const AWS = require('aws-sdk');
const gm = require("gm").subClass({
  imageMagick: true
});
const s3 = new AWS.S3();
const PDFDocument = require('pdf-lib').PDFDocument;
const convert = (body, index, bucket, dist) => {
  return new Promise((resolve, reject) => {
    console.log(`gm process started: page ${index}.`);
    gm(body, `pdf.pdf[${index}]`)
      .resize(2300)
      .density(300)
      .quality(100)
      .setFormat('jpeg')
      .stream((error, stdout, stderr) => {
        if (error) {
          console.log("gm conversion process error::1");
          reject(error);
        }
        const chunks = [];
        stdout.on('data', (chunk) => {
          chunks.push(chunk);
        });
        stdout.on('end', () => {
          console.log(`gm process complete: page ${index}.`);
          const buffer = Buffer.concat(chunks);
          console.log(buffer);


          // uploadFileOnS3(buffer, `Test_${index}.jpg`)
          s3.putObject({
            Bucket: "imgmagik",
            Key: `Tes_${index}.jpeg`,
            ContentType: 'image/jpeg',
            Body: buffer,
          }, (error, data) => {
            if (error) {
              console.log("gm conversion process error::2");
              reject(error);
            }
            resolve();
          });
        });
        stderr.on('data', (data) => {
          console.log('stderr:', data);
        });
      });
  });
}

async function uploadFileOnS3(fileData, fileName) {
  const params = {
    Bucket: "imgmagik",
    Key: fileName,
    Body: fileData,
  };

  try {
    const response = await s3.upload(params).promise();
    console.log('Response: ', response);
  } catch (err) {
    console.log(err);
  }
};

async function handler(event, context, callback) {
  try {
    console.log('starting converting process...');
    console.log('start downloaded PDF...');
    const bucket = event.Records[0].s3.bucket.name;
    const key = decodeURIComponent(event.Records[0].s3.object.key).replace(/\+/g, ' ');
    const pdf = await s3.getObject({
      Bucket: bucket,
      Key: key,
    }).promise();
    console.log('converting PDF to images...');
    const pdoc = await PDFDocument.load(pdf.Body);
    const pageCount = pdoc.getPageCount();
    console.log('pageCount: ', pageCount);
    const pages = Array.from({
      length: pageCount
    }).map((_, i) => i);

    for await (let page of pages) {
      console.log(`Before ${page}/${pages.length}`);
      await convert(pdf.Body, page, bucket, key);
      console.log(`After ${page}`);
    }
    callback(null, {
      statusCode: 200,
      message: 'Success',
    });
  } catch (error) {
    console.error(JSON.stringify(error));
    callback(null, {
      statusCode: 400,
      message: 'Failed',
    });
  }
}
exports.handler = handler;