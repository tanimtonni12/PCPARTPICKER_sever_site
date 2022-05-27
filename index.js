const express = require('express')
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;

//middle ware
app.use(cors());
app.use(express.json());

//db connection

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.5czhzhs.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

//jwt
function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'UnAuthorized access' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden access' })
        }
        req.decoded = decoded;
        next();
    });
}

async function run() {
    try {
        await client.connect();
        const toolsCollection = client.db('pc-parts-manufacturer').collection('tools');
        const userCollection = client.db('pc-parts-manufacturer').collection('users');
        const orderCollection = client.db('pc-parts-manufacturer').collection('orders');
        const reviewCollection = client.db('pc-parts-manufacturer').collection('reviews');


        //verifyadmin
        const verifyAdmin = async (req, res, next) => {
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({ email: requester });
            if (requesterAccount.role === 'admin') {
                next();
            }
            else {
                res.status(403).send({ message: 'forbidden' });
            }
        }


        app.get('/tools', async (req, res) => {
            const query = {};
            const cursor = toolsCollection.find(query);
            const tools = await cursor.toArray();
            res.send(tools);

        });
        //find one
        app.get('/tools/:id', verifyJWT, async (req, res) => {
            console.log(req.params.id)
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const tool = await toolsCollection.findOne(query);

            res.send(tool);

        });


        app.post('/tools', verifyJWT, verifyAdmin, async (req, res) => {
            const product = req.body;
            const result = await toolsCollection.insertOne(product);
            res.send(result);
        });
        app.delete('/tools/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await toolsCollection.deleteOne(filter);
            res.send(result);
        })
        app.get('/user', verifyJWT, async (req, res) => {
            const users = await userCollection.find().toArray();
            res.send(users);
        });

        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;

            const user = req.body;

            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send({ result, token });
        });
        //get the admin

        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email });
            const isAdmin = user.role === 'admin';
            res.send({ admin: isAdmin })
        })
        //admin
        app.put('/user/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const updateDoc = {
                $set: { role: 'admin' },
            };
            const result = await userCollection.updateOne(filter, updateDoc);
            res.send(result);
        });

        //get all orders
        app.get('/order', verifyJWT, verifyAdmin, async (req, res) => {
            const orders = await orderCollection.find().toArray()
            res.send(orders)
        });
        app.get('/order/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const orders = await orderCollection.findOne(query);
            res.send(orders);
        })


        app.post('/order', async (req, res) => {
            const orderProduct = req.body;
            const product = await toolsCollection.findOne({ _id: ObjectId(orderProduct.productId) });
            await toolsCollection.updateOne({ _id: ObjectId(orderProduct.productId) }, { $set: { p_quantity: parseInt(product.p_quantity) - parseInt(orderProduct.order_quantity) } })
            const order = await orderCollection.insertOne(orderProduct);

            res.send({ order, success: true });
        });

        // //getting my orders by filtering email
        // app.get('/order', verifyJWT, async (req, res) => {
        //     const email = req.query.email
        //     const decodedEmail = req.decoded.email
        //     if (email === decodedEmail) {
        //         const query = { email: email }
        //         const orders = await orderCollection.find(query).toArray()
        //         res.send(orders)
        //     }
        //     else {
        //         return res.status(403).send({ message: 'Forbidden accsess' })
        //     }
        // })



        app.get('/myorder', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const order = await orderCollection.find(query).toArray();
            res.send(order);
        });
        app.get('/myorder/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await orderCollection.findOne(query);
            res.send(result);
        });
        //add review
        app.post('/addReview', async (req, res) => {
            const result = await reviewCollection.insertOne(req.body);
            // console.log(result);
            res.send(result);
        });
        app.get('/reviews', async (req, res) => {
            const result = await reviewCollection.find({}).toArray();
            res.send(result);
        });

    }
    finally {

    }

}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('Hello FROM PCPARTSPICKER!')
})

app.listen(port, () => {
    console.log(`PCPARTSPICKER listening on port ${port}`)
})