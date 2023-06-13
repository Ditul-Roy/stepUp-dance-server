const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const app = express();
const port = process.env.port || 5000;

app.use(cors());
app.use(express.json());

const verifyUserWithJWT = (req, res, next) =>{
  const authorization = req.headers.authorization;
  if(!authorization){
    return res.status(401).send({error: true, message: 'unauthorized access'})
  }
  const token = authorization.split(' ')[1];
  jwt.verify(token, process.env.JWT_ACCESS_TOKEN, (error, decoded) => {
    if(error){
      return res.status(401).send({error: true, message: 'unauthorized access'})
    }
    req.decoded = decoded;
    next();
  })
}

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
    const selectedCollection = client.db('dancingDB').collection('selecteds')
    const userCollection = client.db('dancingDB').collection('users')

    
    // jwt Router
    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_ACCESS_TOKEN, {expiresIn: '1h'})
      res.send({token})
    })

    // dances/classes section 
    // all user can be access
    // users collection
    app.get('/dances', async (req, res) => {
      const result = await danceCollection.find().sort({ total_students: -1 }).toArray();
      res.send(result)
    })

    // all user route
    // userCollection route
    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existing = await userCollection.findOne(query);
      if (existing) {
        return res.send({ message: 'user already exist' })
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    })

    // admin can be access
    app.get('/users',verifyUserWithJWT, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    })
    // create user on admin route 
    app.patch('/users/admin/:id',verifyUserWithJWT, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result)
    })
    // admin can access and aproved the class of instructor
    app.patch('/classes/aproved/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: 'aproved'
        }
      }
      const result = await danceCollection.updateOne(filter, updatedDoc);
      res.send(result)
    })

    // admin can access and denied the class of instructor
    app.patch('/classes/denied/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: 'denied'
        }
      }
      const result = await danceCollection.updateOne(filter, updatedDoc);
      res.send(result)
    })

    // create user on instructor
    app.patch('/users/instructor/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: 'instructor'
        }
      }
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result)
    })


    // instructor can be access this route
    app.post('/classes', async (req, res) => {
      const classes = req.body;
      const result = await danceCollection.insertOne(classes);
      res.send(result);
    })

    // instructor can be access this route
    app.get('/classes',verifyUserWithJWT, async (req, res) => {
      const email = req.query?.email;
      if(req.decoded.email !== email){
        return res.send({error: true, message: 'forbidden acces'})
      } 
      let query = {};
      if (email) {
        query = { email: email }
      }
      const result = await danceCollection.find(query).toArray();
      res.send(result);
    })
    // instructor can be access this route
    app.put('/classes/:id/book', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updatedDoc = {
        $inc: {
          total_students: 1,
          available_seats: - 1
        }
      }
      const result = await danceCollection.updateOne(query, updatedDoc);
      res.send(result);
    })

    // instructors section this is for  our instructors page
    app.get('/instructors', async (req, res) => {
      const result = await instructorCollection.find().toArray();
      res.send(result)
    })

    // select section
    // all user can be access
    app.get('/selects',verifyUserWithJWT, async (req, res) => {
      const email = req.query?.email;
      if(req.decoded.email !== email){
        res.send({error: true, message: 'forbidden access'})
      }
      let query = {};
      if (email) {
        query = { email: email };
      }
      const result = await selectedCollection.find(query).toArray();
      res.send(result)
    })
    // all user can be access
    app.post('/selects', async (req, res) => {
      const select = req.body;
      const result = await selectedCollection.insertOne(select);
      res.send(result);
    })
    // all user can be access
    app.delete('/selects/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await selectedCollection.deleteOne(query);
      res.send(result);
    })

    // payment related section

    app.post('/create-payment-intent', async (req, res) => {
      const { price } = req.body;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      })
      res.send({
        clientSecret: paymentIntent.client_secret
      })
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


app.get('/', (req, res) => {
  res.send('the dance ecademy server is running')
})

app.listen(port, () => {
  console.log(`the server is dancing on port: ${port}`);
})