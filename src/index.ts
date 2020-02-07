import express, { Request, Response } from 'express'
import { NextFunction } from 'connect'
import dotenv from 'dotenv'
import path from 'path'
import { createConnection } from 'typeorm'
import expressEjsLayouts from 'express-ejs-layouts'
import AuthRouter from './routes/AuthRouter'
import session from 'express-session'
import _RedisStore from 'connect-redis'
import redis from './utils/RedisUtil'
import { User } from './database/entities/User'
import LegalRouter from './routes/LegalRouter'
import ms from 'ms'
import AccountRouter from './routes/AccountRouter'
import ApiRouter from './routes/ApiRouter'
import AdminRouter from './routes/AdminRouter'
import ModeratorRouter from './routes/ModeratorRouter'
import Cache from './utils/CacheUtil'
import { Image } from './database/entities/Image'
import { ShortenedUrl } from './database/entities/ShortenedUrl'
import { botLogin, userSessionSteal } from './bot'
import OAuthRouter from './routes/OAuthRouter'
import AnalyticsRouter from './routes/AnalyticsRouter'
import * as Sentry from '@sentry/node'
import morgan from 'morgan'
import Logger from 'logdna'
import * as os from 'os'
import { Banner } from './database/entities/Banner'
import { Server } from 'http'
import SocketIO from 'socket.io'
import { initCounts } from './utils/SocketUtil'
import { Report } from './database/entities/Report'
dotenv.config()

// This allows TypeScript to detect our global value
declare global {
  namespace NodeJS {
    interface Global {
      __rootdir__: string
    }
  }
}

global.__rootdir__ = __dirname || process.cwd()

if (!!process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN
  })
}
const logger = Logger.createLogger(process.env.LOGDNA_INGESTION_KEY!, {
  hostname: os.hostname()
})
const RedisStore = _RedisStore(session)

const app = express()

const server = new Server(app)
const io = SocketIO(server)

const stream = {
  write: (message: any) => {
    console.log(message)
    logger.info(message)
  }
}

app.use(Sentry.Handlers.requestHandler())
app.use(
  morgan('combined', {
    stream
  })
)
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))
app.use(expressEjsLayouts)
app.set('layout', 'layouts/layout')
app.set('layout extractScripts', true)
app.set('layout extractStyles', true)
app.set('layout extractMetas', true)

app.enable('trust proxy')

app.use(
  session({
    cookie: {
      maxAge: ms('12 hours')
    },
    store: new RedisStore({
      client: redis
    }),
    secret: process.env.SECRET!,
    resave: false,
    saveUninitialized: true
  })
)

app.use(express.static(path.join(__dirname, 'static')))

app.use((req, res, next) => {
  req.flash = (clazz: string, message: string) => {
    req.session!.flashes = req.session!.flashes || []
    req.session!.flashes.push({ class: clazz, message })
  }
  return next()
})

app.use(async (req, res, next) => {
  // banners
  res.locals.banners = []

  const banners = await Banner.find({
    where: {
      enabled: true
    }
  })
  res.locals.banners = banners.map(banner => ({
    class: banner.class,
    message: banner.message
  }))

  if (req.session!.flashes) {
    res.locals.banners = res.locals.banners.concat(req.session!.flashes)
    req.session!.flashes = undefined
  }

  return next()
})
app.use(async (req, res, next) => {
  res.locals.analyticsEnabled = process.env.ANALYTICS_ENABLED === 'true'
  res.locals.analyticsTrackingCode = process.env.ANALYTICS_TRACKINGID
  if (req.session!.loggedIn) {
    let relations: string[] = [] // ['images', 'invites', 'urls']
    if (req.url.includes('/account/images')) {
      relations.push('images')
    }
    if (req.url.includes('/account/invites')) {
      relations.push('invites')
    }
    if (req.url.includes('/account/urls')) {
      relations.push('urls')
    }
    let user = await User.findOne({
      where: {
        id: req.session!.user
      },
      relations
    })
    if (!user) return next()
    req.user = user
    req.loggedIn = true
    res.locals.profile = req.user.serialize()
  } else {
    req.loggedIn = false
  }

  if (req.session!.mfa_jail) {
    let user = await User.findOne({
      where: {
        id: req.session!.user
      }
    })
    if (!user) return next()
    req.user = user
  }
  res.locals.loggedIn = req.loggedIn
  if (req.loggedIn) {
    if (req.user.suspended) {
      if (req.user.admin) {
        res.locals.banners.push({
          class: 'is-danger',
          message:
            'Your account was suspended, but you are an admin. You were not logged out.'
        })
      } else {
        res.locals.banners.push({
          class: 'is-danger',
          message: 'Your account was suspended, please check your email.'
        })
        req.loggedIn = false
        delete req.user
        delete req.session
        res.locals.profile = undefined
        res.locals.loggedIn = false
      }
    }
  }

  if (req.session && req.session!.loggedIn) {
    if (req.session!.ip !== req.ip) {
      res.locals.profile = undefined
      res.locals.loggedIn = false
      req.loggedIn = false
      userSessionSteal(
        req.user,
        req.session!.ip,
        req.ip,
        req.headers['user-agent'] || ''
      )
      req.session.loggedIn = false
      res.locals.banners.push({
        class: 'is-danger',
        message: 'Your IP has changed, you must login again.'
      })
    }
  }
  return next()
})
app.use(async (req, res, next) => {
  if (req.loggedIn && req.user.moderator) {
    let reports = await Report.find({
      where: {
        resolved: false
      }
    })
    if (reports.length > 0) {
      res.locals.banners.push({
        class: 'is-warning',
        message: `There are <strong>${reports.length}</strong> unresolved reports. <a href="/moderator/reports">Review in mod panel</a>`
      })
    }
  }
  return next()
})
app.use(async (req, res, next) => {
  if (
    req.loggedIn &&
    (req.user.moderator || req.user.admin) &&
    !req.user.mfa_enabled
  ) {
    res.locals.banners.push({
      class: 'is-danger',
      message:
        'You must configure mfa before performing any moderation actions. <a href="/account/mfa">Configure your mfa settings</a>'
    })
  }
  return next()
})

app.use((req, res, next) => {
  // Active path classes and screenreader functions on res.locals
  res.locals.activePath = (path: string) => req.path == path

  res.locals.activePathIdx = (path: string) => req.path.indexOf(path) != -1

  res.locals.activePathSw = (path: string) => req.path.startsWith(path)

  res.locals.activePathBu = (path: string) => req.baseUrl === path

  res.locals.originalUrl = (path: string) =>
    req.originalUrl.startsWith(path) ? 'is-active' : ''

  res.locals.originalUrlEq = (path: string) =>
    req.originalUrl === path ? 'is-active' : ''

  res.locals.nbPath = (path: string) =>
    res.locals.activePath(path) ? 'is-active' : ''

  res.locals.nbSwPath = (path: string) =>
    res.locals.activePathSw(path) ? 'is-active' : ''

  res.locals.nbBuPath = (path: string) =>
    res.locals.activePathBu(path) ? 'is-active' : ''
  return next()
})

app.use('/auth', AuthRouter)
app.use('/account', AccountRouter)
app.use('/legal', LegalRouter)
app.use('/api', ApiRouter)
app.use('/admin', AdminRouter)
app.use('/moderator', ModeratorRouter)
app.use('/analytics', AnalyticsRouter)
app.use('/oauth', OAuthRouter)

async function getIndexLocals(): Promise<{
  users: number
  images: number
  urls: number
}> {
  // typescript what the fuck
  let users = ((await Cache.get('index.users')) as any) as number
  let images = ((await Cache.get('index.images')) as any) as number
  let urls = ((await Cache.get('index.urls')) as any) as number
  if (!users) {
    users = (await User.find()).length
    await Cache.set('index.users', users)
  }
  if (!images) {
    images = (await Image.find()).length
    await Cache.set('index.images', images)
  }
  if (!urls) {
    urls = (await ShortenedUrl.find()).length
    await Cache.set('index.urls', urls)
  }
  return {
    users,
    images,
    urls
  }
}

app.get('/', async (req, res) => {
  let locals = await getIndexLocals()
  res.render('pages/index', locals)
})

app.get('/discord', (req, res) => {
  res.redirect('https://discord.gg/xTs2HbC')
})

app.get('/contact', (req, res) => {
  res.render('pages/contact')
})

app.get('/error', (req, res) => {
  throw new Error('Test exception')
})

app.use((req, res) => {
  return res.render('pages/errors/404', {
    layout: 'layouts/layout'
  })
})

app.use(Sentry.Handlers.errorHandler())

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Sent error to sentry', err)
  if ((err as any).field) {
    console.error((err as any).field)
  }
  return res.render('pages/errors/500', {
    layout: 'layouts/layout',
    sentry: (res as any).sentry
  })
})

createConnection({
  type: 'postgres',
  host: process.env.TYPEORM_HOST,
  username: process.env.TYPEORM_USERNAME,
  password: process.env.TYPEORM_PASSWORD,
  database: process.env.TYPEORM_DATABASE,
  synchronize: true,
  logging: false,
  entities: [__dirname + '/database/entities/**/*.{ts,js}'],
  migrations: [__dirname + '/database/migrations/**/*.{ts,js}'],
  subscribers: [__dirname + '/database/subscribers/**/*.{ts,js}']
})
  .then(() => {
    server.listen(process.env.PORT, () => {
      console.log('listening on port', process.env.PORT)
      initCounts()
      botLogin()
    })
  })
  .catch(err => {
    console.error(err)
  })

export { server, io }
