import express from 'express'
import bodyParser from 'body-parser'
import multer from 'multer'
import { bucket, oldBucket1, oldBucket2 } from '../utils/StorageUtil'
import crypto from 'crypto'
import { User } from '../database/entities/User'
import {
  randomImageId,
  randomUserId,
  randomInvisibleId
} from '../utils/RandomUtil'
import { Image } from '../database/entities/Image'
import rb from 'raw-body'
import path from 'path'
import { ShortenedUrl } from '../database/entities/ShortenedUrl'
import { increaseImage, increaseUrl, sendImage } from '../utils/SocketUtil'
import * as _ from 'lodash'
import { Domain } from '../database/entities/Domain'
import { limiter, pasteLimiter } from '../utils/RatelimitUtil'
import { Paste } from '../database/entities/Paste'
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
  file: Express.Multer.File,
  useOriginalName: boolean
): Promise<Image> {
  if (!user.admin) {
    useOriginalName = false
  }
  let randomId = useOriginalName
    ? file.originalname.split('.')[0]
    : randomImageId(user.longNames)

  if (useOriginalName) {
    let files = await Image.find({
      where: {
        shortId: randomId
      }
    })
    if (files.length > 0) {
      throw new Error('Short id already exists in db')
    }
  }

  if (host === '#random#') {
    let randomDomains = user.randomDomains
    if (randomDomains.length === 0) {
      randomDomains.push('mirage.re')
    }
    host = _.sample(randomDomains)!
  }

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
  increaseImage()
  sendImage(image)
  return image
}

ApiRouter.route('/upload/paste').post(pasteLimiter, async (req, res) => {
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
  const sha1 = crypto.createHash('sha1')
  const paste = new Paste()
  const content = Buffer.from(req.body.content)
  paste.uploader = req.user
  paste.content = content.toString('base64')
  paste.creationDate = new Date()
  paste.deleted = false
  paste.encrypted = false
  paste.hash = sha1.update(content).digest('hex')
  paste.id = randomUserId()
  paste.shortId = randomImageId(req.user.longNames)
  paste.size = content.byteLength
  await paste.save()
  return res.json({
    success: true,
    url: `https://mirage.photos/paste/${paste.shortId}`
  })
})

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
    req.file,
    req.body.useOriginalName === '1'
  )
  return res.send(image.url)
})

ApiRouter.route('/upload/site').post(
  upload.single('file'),
  async (req, res) => {
    if (!req.loggedIn) {
      return res.status(403).send('not logged in')
    }
    let user = req.user
    if (user.suspended) {
      return res
        .status(401)
        .send('User is suspended, check email for more information')
    }
    let image = await uploadImage(
      'mirage.wtf',
      user,
      req.file,
      req.body.useOriginalName === '1'
    )
    return res.send(image.url)
  }
)

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
      req.file,
      req.body.useOriginalName === '1'
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
      req.file,
      req.body.useOriginalName === '1'
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
  let rndFn = user.invisibleShortIds ? randomInvisibleId : randomImageId
  let host = req.body.host || req.hostname || 'mirage.re'
  if (host === '#random#') {
    let randomDomains = user.randomDomains
    if (randomDomains.length === 0) {
      randomDomains.push('mirage.re')
    }
    host = _.sample(randomDomains)!
  }
  let url = new ShortenedUrl()
  url.id = randomUserId()
  url.creator = user
  url.host = host
  url.shortId = rndFn(user.longNames)
  url.url = req.body.url
  url.creationDate = new Date()
  await url.save()
  increaseUrl()
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
  if (req.query && typeof req.query.lookup !== 'undefined') {
    return res.redirect(
      `https://mirage.photos/moderator/images/${req.params.file}`
    )
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

ApiRouter.route('/domains').get(limiter, async (req, res) => {
  const domains = (
    await Domain.find({
      where: {
        public: true
      }
    })
  ).map(domain => domain.apiSerialize())

  return res.json({
    meta: {
      status: 200,
      message: 'OK'
    },
    domains
  })
})

export default ApiRouter
