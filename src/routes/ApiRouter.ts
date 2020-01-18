import express from 'express'
import bodyParser from 'body-parser'
import multer from 'multer'
import { bucket, oldBucket1, oldBucket2 } from '../utils/StorageUtil'
import crypto from 'crypto'
import { User } from '../database/entities/User'
import { randomImageId, randomUserId } from '../utils/RandomUtil'
import { Image } from '../database/entities/Image'
import rb from 'raw-body'
import path from 'path'
import { ShortenedUrl } from '../database/entities/ShortenedUrl'
const ApiRouter = express.Router()

ApiRouter.use(bodyParser.json())
ApiRouter.use(
  bodyParser.urlencoded({
    extended: true
  })
)

const upload = multer({
  storage: multer.memoryStorage()
})

async function uploadImage(
  host: string,
  user: User,
  file: Express.Multer.File
): Promise<Image> {
  let randomId = randomImageId(user.longNames)
  let image = new Image()
  image.id = randomUserId()
  image.shortId = randomId
  image.host = host
  // get extension
  let ext = path.extname(file.originalname)
  //image.path = `${randomId}.${mime.extension(file.mimetype)}`
  image.path = `${randomId}${ext}`
  image.size = file.size
  image.uploadDate = new Date()
  image.url = `https://${host}/${image.path}`
  const sha1 = crypto.createHash('sha1')
  image.hash = sha1.update(file.buffer).digest('hex')
  image.uploader = user
  image.contentType = file.mimetype
  image.originalName = file.originalname
  await image.save()
  await bucket.file(image.path).save(file.buffer)
  return image
}

ApiRouter.route('/upload').post(upload.single('file'), async (req, res) => {
  let key = req.body.key
  let user = await User.findOne({
    where: {
      uploadKey: key
    }
  })
  if (!user) {
    return res.status(401).send('Upload key is invalid')
  }
  if (user.suspended) {
    return res
      .status(401)
      .send('User is suspended, check email for more information')
  }
  let image = await uploadImage(
    req.body.host || req.hostname || 'mirage.re',
    user,
    req.file
  )
  return res.send(image.url)
})
ApiRouter.route('/upload/shortcuts/:host/:key').post(
  upload.single('file'),
  async (req, res) => {
    let key = req.params.key
    let user = await User.findOne({
      where: {
        uploadKey: key
      }
    })
    if (!user) {
      return res.status(401).send('Upload key is invalid')
    }
    if (user.suspended) {
      return res
        .status(401)
        .send('User is suspended, check email for more information')
    }
    let image = await uploadImage(
      req.params.host || req.hostname || 'mirage.re',
      user,
      req.file
    )
    return res.send(image.url)
  }
)
ApiRouter.route('/upload/pomf/:key').post(
  upload.single('file[]'),
  async (req, res) => {
    let key = req.params.key
    let user = await User.findOne({
      where: {
        uploadKey: key
      }
    })
    if (!user) {
      return res.status(401).send('Upload key is invalid')
    }
    if (user.suspended) {
      return res
        .status(401)
        .send('User is suspended, check email for more information')
    }
    let image = await uploadImage(
      req.body.host || req.hostname || 'mirage.re',
      user,
      req.file
    )
    return res.json({
      success: true,
      files: [
        {
          hash: image.hash,
          name: image.originalName,
          url: image.url,
          size: image.size
        }
      ]
    })
  }
)

ApiRouter.route('/shorten').post(async (req, res) => {
  let key = req.body.key
  let user = await User.findOne({
    where: {
      uploadKey: key
    }
  })
  if (!user) {
    return res.status(401).send('Upload key is invalid')
  }
  if (user.suspended) {
    return res
      .status(401)
      .send('User is suspended, check email for more information')
  }
  let host = req.body.host || req.hostname || 'mirage.re'
  let url = new ShortenedUrl()
  url.id = randomUserId()
  url.creator = user
  url.host = host
  url.shortId = randomImageId(user.longNames)
  url.url = req.body.url
  url.creationDate = new Date()
  await url.save()
  return res.send(`https://${host}/${url.shortId}`)
})

ApiRouter.route('/image').get((req, res) => {
  return res.redirect(process.env.BASE_URL!)
})
ApiRouter.route(['/image/:file', '/image/*/:file']).get(async (req, res) => {
  if (req.params.file && !req.params.file.includes('.')) {
    // Shortened url
    let shortUrl = await ShortenedUrl.findOne({
      where: {
        shortId: req.params.file
      },
      relations: ['creator']
    })
    if (!shortUrl) {
      return res.status(404).send('URL not found')
    }
    if (shortUrl.creator.suspended) {
      return res
        .status(404)
        .send(
          'The shortened URL you requested is unavailable because the creator was suspended.'
        )
    }
    if (shortUrl.deleted) {
      return res
        .status(404)
        .send(
          shortUrl.deletionReason === 'USER'
            ? 'Shortened URL was deleted at request of user'
            : 'Shortened URL was deleted by staff'
        )
    }
    return res.redirect(shortUrl.url)
  }
  if (req.params.file === 'favicon.ico') {
    let [_file] = await bucket.file('/meta/logo.png').get()
    let buf = await rb(_file.createReadStream())
    return res.contentType('image/png').send(buf)
  }
  let image = await Image.findOne({
    where: {
      path: req.params.file
    },
    relations: ['uploader']
  })

  if (image && image.deleted) {
    let [_file] = await bucket
      .file(`/meta/deletion-${image.deletionReason.toLowerCase()}.png`)
      .get()
    let buf = await rb(_file.createReadStream())
    return res
      .status(404)
      .contentType('image/png')
      .send(buf)
  }

  if (image && image.uploader.suspended) {
    let [_file] = await bucket.file(`/meta/image-suspended.png`).get()
    let buf = await rb(_file.createReadStream())
    return res.contentType('image/png').send(buf)
  }

  let file = null

  let mimeType = image ? image.contentType : 'image/png'
  if (!image) {
    try {
      let [_file] = await oldBucket1.file(req.params.file).get()
      file = _file
    } catch (err) {
      try {
        let [_file] = await oldBucket2.file(req.params.file).get()
        file = _file
      } catch (err) {
        let [_file] = await bucket.file('/meta/image-notfound.png').get()
        file = _file
      }
    }
  } else {
    try {
      let [_file] = await bucket.file(req.params.file).get()
      file = _file
    } catch (err) {
      return res.send(
        'error occurred while pulling the image from the storage server'
      )
    }
  }

  let buf = await rb(file.createReadStream())
  return res.contentType(mimeType).send(buf)
})

export default ApiRouter
