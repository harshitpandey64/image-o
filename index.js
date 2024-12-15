const fs = require('fs');
const sharp = require('sharp');
const express = require('express');
const multer = require('multer');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(express.static('public'));

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


async function decodeImage(encryptedImagePath, outputImagePath) {
  const image = sharp(encryptedImagePath);
  const { width, height } = await image.metadata();
  const rawImage = await image.raw().toBuffer();

  let bitString = '';
  for (let i = 0; i < width * height; i++) {
    const bit = rawImage[i * 4]; // Read from the red channel
    bitString += String.fromCharCode(bit);
  }

  const originalImageBuffer = Buffer.from(bitString, 'binary');
  await fs.promises.writeFile(outputImagePath, originalImageBuffer);
}

app.post('/encode', upload.single('originalImage'), async (req, res) => {
  try {
    const originalImagePath = req.file.path;
    const encodedImagePath = path.join(__dirname, 'public', 'encoded.png');

    console.log('Converting image to bit string...');
    const bitString = await imageToBitString(originalImagePath);

    console.log('Encoding bit string into encrypted image...');
    await encodeImage(bitString, encodedImagePath);

    res.download(encodedImagePath, 'encoded.png');
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).send('Encoding failed: ' + error.message);
  }
});

app.post('/decode', upload.single('encodedImage'), async (req, res) => {
  try {
    const encodedImagePath = req.file.path;
    const decodedImagePath = path.join(__dirname, 'public', 'decoded.jpg');

    console.log('Decoding the encrypted image to retrieve the original image...');
    await decodeImage(encodedImagePath, decodedImagePath);

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