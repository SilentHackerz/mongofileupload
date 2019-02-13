const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const multer = require('multer');

// Given I will deploy it in Heroku, I shall use process.env.port but locally my app will run on port 5080
const port = process.env.PORT || 5080;

//multer-GridFS storage engine for Multer to store uploaded files directly to MongoDb
const GridFsStorage = require('multer-gridfs-storage');

const Grid = require('gridfs-stream');

//methodOveerride - Lets you use HTTP verbs such as PUT or DELETE in places where the client doesn't support it.

const methodOverride = require('method-override');

const app = express()

// Middleware
app.use(bodyParser.json());
app.use(methodOverride('_method'));
app.set('view engine', 'ejs');

// Mongo URI
const mongoURI = 'mongodb://silenthacker:abc123@ds129051.mlab.com:29051/mongofileuploads';

// Create mongo connection
const conn = mongoose.createConnection(mongoURI);

// Init gridfs-stream
let gfs;

// Streaming files to and from MongoDB
conn.once('open', () => {
    // Init stream
    gfs = Grid(conn.db, mongoose.mongo);
    gfs.collection('uploads');
  });


//Create a storage object with a given configuration
const storage = new GridFsStorage({
    url: mongoURI,
    file: (req, file) => {
        return new Promise((resolve, reject) => {
            crypto.randomBytes(16, (err, buf) => {
                if (err) {
                    return reject(err);
                }
                const filename = buf.toString('hex') + path.extname(file.originalname)
                const fileInfo = {
                    filename: filename,
                    bucketName: 'uploads'
                }
                resolve(fileInfo)
            })
        })
    }
})

//Now Set multer storage engine to the newly created object
const upload = multer({ storage });

//@route GET /
//@desc Loads form

app.get('/', (req, res) => {
    gfs.files.find().toArray((err, files) => {
      // Check if files
      if (!files || files.length === 0) {
        res.render('index', { files: false });
      } else {
        files.map(file => {
          if (
            file.contentType === 'image/jpeg' ||
            file.contentType === 'image/png'
          ) {
            file.isImage = true;
          } else {
            file.isImage = false;
          }
        });
        res.render('index', { files: files });
      }
    });
  });

// @route POST /upload
 //@desc  Uploads file to DB
app.post('/upload', upload.single('file'), (req, res) => {
    res.redirect('/')
})

// @route GET /files
// @desc  Display all files in JSON - same logic as above for rendering the index.ejs file
app.get('/files', (req, res) => {
    gfs.files.find().toArray((err, files) => {
        if (!files || files.length === 0 ) {
            return res.status(404).json({
                err: 'No files exists'
            });
        }

        // Else files exists, hence return it
        return res.json(files)
    })
})

// @route GET /files/:filename
// @desc  Display single file object
app.get('/files/:filename', (req, res) => {
    gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
        if (!file || file.length === 0 ) {
            return res.status(404).json({
                err: 'No file exists'
            });
        }
        // Else the files exists, hence return it
        return res.json(file)
    })
})

// @route GET /image/:filename
// @desc Display Image
app.get('/image/:filename', (req, res) => {
    gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
        if (!file || file.length === 0) {
            return res.status(404).json({
                err: 'No file exists'
            })
        }

        // check for image and if true, then I have to create a readStream to read that file
        if (file.contentType === 'image/jpeg' || file.contentType === 'image/png') {
            const readStream = gfs.createReadStream(file.filename);
            readStream.pipe(res)
        } else {
            res.status(404).json({
                err: 'File is not a jpeg or png file type'
            });
        }
    });
})

// @route DELETE /files/:id
// @desc Delete file
app.delete('/files/:id', (req, res) => {
    gfs.remove({ _id: req.params.id, root: 'uploads' }, (err, gridStore) => {
        if (err) {
            return res.status(404).json({
                err: err
            })
        }
        res.redirect('/')
    })
})

app.listen(port, () => console.log(`The server started on port ${port}`))