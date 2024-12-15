const fs = require('fs');
const sharp = require('sharp');
const express = require('express');
const multer = require('multer');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(express.static('public'));

const IMGBB_API_KEY = '#';

async function imageToBitString(imagePath) {
  const buffer = await fs.promises.readFile(imagePath);
  return buffer.toString('binary');
}

async function encodeImage(bitString, outputPath) {
  const width = 500; 
  const height = Math.ceil(bitString.length / (8 * width)); 
  const pixelData = Buffer.alloc(width * height * 4, 0); 

  for (let i = 0; i < bitString.length; i++) {
    const bit = bitString.charCodeAt(i);
    pixelData[i * 4] = bit; 
  }

  await sharp(pixelData, { raw: { width, height, channels: 4 } })
    .toFile(outputPath);
}


async function decodeImageFromURL(imageURL, outputImagePath) {
  const response = await axios.get(imageURL, { responseType: 'arraybuffer' });
  const imageBuffer = Buffer.from(response.data);

  const image = sharp(imageBuffer);
  const { width, height } = await image.metadata();
  const rawImage = await image.raw().toBuffer();

  let bitString = '';
  for (let i = 0; i < width * height; i++) {
    const bit = rawImage[i * 4]; 
    bitString += String.fromCharCode(bit);
  }

  const originalImageBuffer = Buffer.from(bitString, 'binary');
  await fs.promises.writeFile(outputImagePath, originalImageBuffer);
}


async function uploadToImgbb(imagePath) {
  const form = new FormData();
  const imageBuffer = await fs.promises.readFile(imagePath);
  form.append('key', IMGBB_API_KEY);
  form.append('image', imageBuffer.toString('base64'));

  const response = await axios.post('https://api.imgbb.com/1/upload', form, {
    headers: form.getHeaders(),
  });

  return response.data.data.url; 
}

app.post('/encode', upload.single('originalImage'), async (req, res) => {
  try {
    const originalImagePath = req.file.path;
    const encodedImagePath = path.join(__dirname, 'encoded.png');

    console.log('Converting image to bit string...');
    const bitString = await imageToBitString(originalImagePath);

    console.log('Encoding bit string into encrypted image...');
    await encodeImage(bitString, encodedImagePath);

    console.log('Uploading encoded image to Imgbb...');
    const encodedImageUrl = await uploadToImgbb(encodedImagePath);

    res.json({ encodedImageUrl });
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).send('Encoding failed: ' + error.message);
  }
});

app.post('/decode-url', express.json(), async (req, res) => {
  try {
    const { imageUrl } = req.body;
    if (!imageUrl) {
      return res.status(400).send('Image URL is required');
    }

    const decodedImagePath = path.join(__dirname, 'decoded.jpg');

    console.log('Decoding the encrypted image from URL...');
    await decodeImageFromURL(imageUrl, decodedImagePath);

    res.download(decodedImagePath, 'decoded.jpg');
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).send('Decoding failed: ' + error.message);
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

