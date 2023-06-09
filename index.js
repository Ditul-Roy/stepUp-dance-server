const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config()
const app = express();
const port= process.env.port || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.bylwpc6.mongodb.net/?retryWrites=true&w=majority`;

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

    const danceCollection = client.db('dancingDB').collection('classes');
    const instructorCollection = client.db('dancingDB').collection('instructors')

    app.get('/dances', async(req, res) => {
        const result = await danceCollection.find().sort({total_students:-1}).toArray();
        res.send(result)
    })

    app.get('/instructors', async(req, res) => {
      const result = await instructorCollection.find().sort({number_of_classes:-1}).toArray();
      res.send(result)
    })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) =>{
    res.send('the dance ecademy server is running')
})

app.listen(port, () => {
    console.log(`the server is dancing on port: ${port}`);
})