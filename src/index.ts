import express from 'express'
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
dotenv.config()

const RedisStore = _RedisStore(session)

const app = express()

app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))
app.use(expressEjsLayouts)
app.set('layout', 'layouts/layout')
app.set('layout extractScripts', true)
app.set('layout extractStyles', true)
app.set('layout extractMetas', true)

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

app.use(async (req, res, next) => {
  if (req.session!.loggedIn) {
    let user = await User.findOne({
      where: {
        id: req.session!.user
      },
      relations: ['images', 'invites']
    })
    if (!user) return next()
    req.user = user
    req.loggedIn = true
    res.locals.profile = req.user.serialize()
  } else {
    req.loggedIn = false
  }
  res.locals.loggedIn = req.loggedIn
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
app.get('/', (req, res) => {
  res.render('pages/index', {
    users: 0,
    images: 0
  })
})

app.get('/discord', (req, res) => {
  res.redirect('https://discord.gg/xTs2HbC')
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
    app.listen(process.env.PORT, () => {
      console.log('listening on port', process.env.PORT)
    })
  })
  .catch(err => {
    console.error(err)
  })

export default app
