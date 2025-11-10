const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
const app = express();
const port = process.env.PORT || 3000;




//middleware
app.use(cors());
app.use(express.json());

//User: simpleDBUser  , password: UTMWKMo0sVfRXrfx
const uri = "mongodb+srv://simpleDBUser:UTMWKMo0sVfRXrfx@cluster0.x6bmi0l.mongodb.net/?appName=Cluster0";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/',(req, res) =>{
    res.send('simple CURD server is available');

})

app.listen(port, () =>{
    console.log(`simple CURD Server started on port : ${port}`)
})