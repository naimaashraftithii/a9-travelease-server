// index.js (TravelEase server)
require('dotenv').config()
const express = require('express')
const cors = require('cors')
const { MongoClient, ObjectId, ServerApiVersion } = require('mongodb')
const admin = require('firebase-admin')
const path = require('path')

const app = express()
const port = process.env.PORT || 3000

// ---------- Firebase Admin (use ./firebase-admin-key.json) ----------
let serviceAccount
try {
  serviceAccount = require(path.join(__dirname, 'firebase-admin-key.json'))
} catch {
  console.error('❌ Missing firebase-admin-key.json next to index.js')
  console.error('   Download it from Firebase > Project settings > Service accounts')
  process.exit(1)
}
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })

// ---------- Middleware ----------
app.use(cors())
app.use(express.json())

// Verify Firebase ID token
const verifyFirebaseToken = async (req, res, next) => {
  const header = req.headers.authorization || ''
  if (!header.startsWith('Bearer ')) {
    return res.status(401).send({ message: 'unauthorized access' })
  }
  const token = header.split(' ')[1]
  try {
    const decoded = await admin.auth().verifyIdToken(token)
    req.token_email = decoded.email
    req.token_uid = decoded.uid
    next()
  } catch (err) {
    return res.status(401).send({ message: 'unauthorized access' })
  }
}

// ---------- MongoDB ----------
const uri = process.env.MONGO_URI
if (!uri) {
  console.error('❌ MONGO_URI missing in .env')
  process.exit(1)
}
const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
})

// Health
app.get('/', (req, res) => {
  res.send('🚗 TravelEase server is running...')
})

async function run () {
  try {
    await client.connect()
    const db = client.db('travelease_db')
    const vehicles = db.collection('vehicles')
    const bookings = db.collection('bookings')
    const users = db.collection('users')

    // Optional helpful indexes
    await vehicles.createIndex({ createdAt: -1 })
    await vehicles.createIndex({ category: 1 })
    await vehicles.createIndex({ location: 1 })
    await vehicles.createIndex({ pricePerDay: 1 })

    // ---------------- USERS ----------------
    app.post('/users', async (req, res) => {
      try {
        const newUser = req.body || {}
        if (!newUser.email) return res.status(400).send({ message: 'email required' })
        const existing = await users.findOne({ email: newUser.email })
        if (existing) return res.send({ message: 'User already exists' })
        const result = await users.insertOne({ ...newUser, createdAt: new Date() })
        res.send(result)
      } catch (e) { res.status(500).send({ message: e.message }) }
    })

    // ---------------- VEHICLES ----------------
    // GET /vehicles?category=&location=&minPrice=&maxPrice=&sortBy=createdAt|pricePerDay&sortOrder=asc|desc&userEmail=
    app.get('/vehicles', async (req, res) => {
      try {
        const {
          category, location, minPrice, maxPrice,
          sortBy = 'createdAt', sortOrder = 'desc',
          userEmail, limit
        } = req.query

        const query = {}
        if (category) query.category = category
        if (location) query.location = { $regex: location, $options: 'i' }
        if (userEmail) query.userEmail = userEmail

        if (minPrice || maxPrice) {
          query.pricePerDay = {}
          if (minPrice) query.pricePerDay.$gte = Number(minPrice)
          if (maxPrice) query.pricePerDay.$lte = Number(maxPrice)
        }

        const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 }
        const cursor = vehicles.find(query).sort(sort)
        if (limit) cursor.limit(Number(limit))
        const items = await cursor.toArray()
        res.send({ items })
      } catch (e) { res.status(500).send({ message: e.message }) }
    })

    app.get('/latest-vehicles', async (_req, res) => {
      try {
        const items = await vehicles.find().sort({ createdAt: -1 }).limit(6).toArray()
        res.send(items)
      } catch (e) { res.status(500).send({ message: e.message }) }
    })

    app.get('/vehicles/:id', async (req, res) => {
      try {
        if (!ObjectId.isValid(req.params.id)) return res.status(400).send({ message: 'Invalid ID' })
        const result = await vehicles.findOne({ _id: new ObjectId(req.params.id) })
        if (!result) return res.status(404).send({ message: 'Vehicle not found' })
        res.send(result)
      } catch (e) { res.status(500).send({ message: e.message }) }
    })

    app.post('/vehicles', verifyFirebaseToken, async (req, res) => {
      try {
        const data = req.body || {}
        const now = new Date()
        const doc = {
          vehicleName: data.vehicleName,
          owner: data.owner,
          category: data.category,
          pricePerDay: Number(data.pricePerDay) || 0,
          location: data.location,
          availability: data.availability || 'Available',
          description: data.description || '',
          coverImage: data.coverImage || '',
          userEmail: req.token_email,  // force ownership from token
          createdAt: now,
          updatedAt: now
        }
        const result = await vehicles.insertOne(doc)
        res.send({ insertedId: result.insertedId, ...doc })
      } catch (e) { res.status(500).send({ message: e.message }) }
    })

    app.patch('/vehicles/:id', verifyFirebaseToken, async (req, res) => {
      try {
        if (!ObjectId.isValid(req.params.id)) return res.status(400).send({ message: 'Invalid ID' })
        const id = new ObjectId(req.params.id)
        const vehicle = await vehicles.findOne({ _id: id })
        if (!vehicle) return res.status(404).send({ message: 'Not found' })
        if (vehicle.userEmail !== req.token_email) return res.status(403).send({ message: 'Forbidden' })

        const update = { $set: { ...req.body, updatedAt: new Date() } }
        const result = await vehicles.updateOne({ _id: id }, update)
        res.send(result)
      } catch (e) { res.status(500).send({ message: e.message }) }
    })

    app.delete('/vehicles/:id', verifyFirebaseToken, async (req, res) => {
      try {
        if (!ObjectId.isValid(req.params.id)) return res.status(400).send({ message: 'Invalid ID' })
        const id = new ObjectId(req.params.id)
        const vehicle = await vehicles.findOne({ _id: id })
        if (!vehicle) return res.status(404).send({ message: 'Not found' })
        if (vehicle.userEmail !== req.token_email) return res.status(403).send({ message: 'Forbidden' })
        const result = await vehicles.deleteOne({ _id: id })
        res.send(result)
      } catch (e) { res.status(500).send({ message: e.message }) }
    })

    // ---------------- BOOKINGS ----------------
    

    app.get('/my-bookings', verifyFirebaseToken, async (req, res) => {
      try {
        const list = await bookings.aggregate([
          { $match: { userEmail: req.token_email } },
          {
            $lookup: {
              from: 'vehicles',
              localField: 'vehicleId',
              foreignField: '_id',
              as: 'vehicle'
            }
          },
          { $unwind: '$vehicle' },
          { $sort: { createdAt: -1 } }
        ]).toArray()
        res.send(list)
      } catch (e) { res.status(500).send({ message: e.message }) }
    })

    console.log('✅ Connected to MongoDB and ready!')
  } catch (err) {
    console.error('❌ Server error:', err)
  }
}
run()

app.listen(port, () => console.log(`🚀 TravelEase server running on port ${port}`))
