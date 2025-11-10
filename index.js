/**
 * A9 TravelEase Server

 */

require('dotenv').config()
const express = require('express')
const cors = require('cors')
const { MongoClient, ServerApiVersion } = require('mongodb')

const app = express()
const port = process.env.PORT || 3000

// Middleware
app.use(cors())
app.use(express.json())



// Create a MongoClient with Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true
  }
})

/**
 * Connect to MongoDB once on server start
 * and keep the connection open.
 */
async function connectDB() {
  try {
    await client.connect()
    // optional: check connection
    await client.db('admin').command({ ping: 1 })
    console.log('Connected to MongoDB successfully!')
  } catch (err) {
    console.error('Mongo connection error:', err)
    process.exit(1)
  }
}
connectDB()

/** Root route for quick health check */
app.get('/', (req, res) => {
  res.send('✅ A9 TravelEase Server is running!')
})

/**
 * Example: get all documents from a collection
 * (replace “vehicles” with your collection name)
 */
app.get('/vehicles', async (req, res) => {
  try {
    const vehiclesCollection = client.db('travelease_db').collection('vehicles')
    const list = await vehiclesCollection.find().toArray()
    res.json(list)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error' })
  }
})

// Start server
app.listen(port, () => {
  console.log(`🚗 A9 TravelEase Server started on port: ${port}`)
})
