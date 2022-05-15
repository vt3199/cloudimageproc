'use strict';

const serverless = require('serverless-http');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const Jimp = require('jimp');
const { v4: uuidv4 } = require("uuid");
const height = 500;
var imageType = "image/png";
require('dotenv').config();
const bucket = process.env.Bucket;
const port = process.env.Port;
const AWS = require('aws-sdk');
const s3 = new AWS.S3();
var params = {
    Bucket: bucket
};

// Cors
app.use(cors());

// Data Parsing
app.use(bodyParser.json({ extended: true }));
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', async (req, res) => {
    const healthcheck = {
		uptime: process.uptime(),
		message: 'OK',
		timestamp: Date.now()
	};

    res.status(200).send(healthcheck);
});

app.get('/health', (req, res) => {
    const healthcheck = {
		uptime: process.uptime(),
		message: 'OK',
		timestamp: Date.now()
	};

    res.status(200).send(healthcheck);
  });

// here you send the URL image 
app.post('/dev/upload', async (req, res, cb) => {

    let path = req.body.photoUrl; // URL Image

    console.log(path);

    let photoUrl = path;
    let objectId = uuidv4();
    let objectKey = `rz-${height}-${objectId}.`;
    
    return fetchImage(photoUrl)
        .then(image => {
            imageType= image.getMIME();

            if(imageType == 'image/png'){
                objectKey= objectKey+'png';
            } else if(imageType == 'image/jpg') {
                objectKey= objectKey+'jpg';
            } else if(imageType == 'image/jpeg') {
                objectKey= objectKey+'jpeg';
            }
            image.resize(Jimp.AUTO, height);
            return image.getBufferAsync(image.getMIME());            
        })
        .then(resizedBuffer => uploadToS3(resizedBuffer, objectKey, imageType))
        .then(function (response) {
            console.log(`Image ${objectKey} was upload and resized`);
            res.status(200).json(response);
        })
        .catch(error => console.log(error));

})


/**
 * @param {*} data
 */
function uploadToS3(data, key, imageType ) {
    console.log('uploadToS3');
    return s3
        .putObject({
            Bucket: bucket,
            Key: key,
            Body: data,
            ContentType: imageType
        })
        .promise();
}



/**
 * @param {url}
 * @returns {Promise}
 */
function fetchImage(url) {
    return Jimp.read(url);
}

app.get('/dev/download', async (req, res, cb) => {
    var bucket = process.env.Bucket;
    let path = req.query.s3Url; // URL Image
    console.log('/dev/download', path);
    var params = { Bucket: bucket, Key: path };

    const data = await s3.getObject(params).promise();
    const contentBody = data.Body;
    const contentType = data.ContentType;

    console.log('path:', path);
    console.log('contentType:', contentType);

    /*     const response = {
          statusCode: 200,
          headers: {
            "Content-Type": contentType,
            "Content-Disposition": "inline; filename="+path
          },
          body: contentBody.toString("base64"),
          isBase64Encoded: true
        }; */

    res.writeHead(200, {
        "Content-Type": contentType,
        "Content-Disposition": "inline; filename=" + path
    });
    res.end(contentBody);

})


app.get('/dev/downloads', async (req, res, cb) => {

    let path = req.body.path; // URL Image
    console.log('getAllImagesBucket:');
    const response = await s3.listObjectsV2(params).promise();
    var contents = response.Contents;
    console.log('going in:');
    contents.forEach(async function (content) {
        console.log('co0oooooooo:');
        console.log('co:', content.Key);
        var file = require('fs').createWriteStream('/tmp/pics/' + content.Key);
        console.log('test1');
        var params = { Bucket: bucket, Key: content.Key };
        //const defImage = await s3.getObject(params).promise();
        s3.getObject(params).createReadStream().pipe(file);

        return {
            statusCode: 200,
            isBase64Encoded: false,
            body: true
        };
    });

    if (response.IsTruncated) {
        params.ContinuationToken = response.NextContinuationToken;
        getAllImagesBucket();
    }

    res.status(200).json(response);
})

async function getAllImagesBucket(path, route) {

    const nameFiles = Date.now().toString();
    const img = await Jimp.read(path);
    const resized = img.resize(250, Jimp.AUTO).quality(0);
    const bufferResized = await resized.getBase64Async(Jimp.MIME_JPEG);
    const buffer = Buffer.from(bufferResized.replace(/^data:image\/\w+;base64,/, ""), 'base64');

    const response = await new Promise(function (resolve) {

        const params = {
            Bucket: bucket,
            Key: `resize/${route}/${nameFiles}.jpeg`,
            Body: buffer,
            ContentType: 'image/jpeg',
            ContentEncoding: 'base64',
            ACL: 'public-read',
            Metadata: {
                CacheControl: 'no-cache'
            }
        };

        return s3.upload(params, function (err, data) {
            if (err) {
                return err;
            } else {
                return resolve(data.Location);
            }
        })

    })

    return response;

}


app.listen(port, () => {
    console.log(`App listening at http://localhost:${port}`)
})