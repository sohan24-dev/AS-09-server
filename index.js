const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4'])


require('dotenv').config()
const express = require('express')
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { createRemoteJWKSet, jwtVerify } = require('jose-cjs');
const app = express()
const port = process.env.PORT


app.use(cors())
app.use(express.json());



const uri = process.env.MONGO_URL;


const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

const JWKS = createRemoteJWKSet(
    new URL(process.env.BASE_URL + "/api/auth/jwks")
)

const verifyToken = async (req, res, next) => {
    const authheader = req?.headers.authorization;
    if (!authheader) {
        return res.status(401).json({
            message: "Unauthrized"
        });
    }
    const token = authheader.split(" ")[1];
    if (!token) {
        return res.status(401).json({
            message: "Unauthrized"
        });
    }
    try {
        const { payload } = await jwtVerify(token, JWKS)
        req.user = payload;
        req.email = payload.email;
        // console.log(payload);
        next()
    } catch (error) {
        return res.status(403).json({
            message: "Forbidden"
        });
    }

}
async function run() {
    try {

        await client.connect();
        const database = client.db('AS-09')
        const movies = database.collection("ideaData");
        const comment = database.collection("comment");




        app.get('/ideadata', async (req, res) => {
            const data = await movies.find().toArray();
            res.json(data)

        })

        app.get("/ideafilter", async (req, res) => {
            try {
                const search = (req.query.search || "").trim();
                const category = (req.query.category || "").trim();

                let query = {};


                if (search) {
                    query.IdeaTitle = {
                        $regex: search,
                        $options: "i",
                    };
                }


                if (category) {
                    query.Category = {
                        $regex: `^${category}$`,
                        $options: "i",
                    };
                }

                const result = await movies.find(query).toArray();

                console.log(result);

                res.send(result);

            } catch (error) {
                console.log(error);

                res.status(500).send({
                    error: "Failed to fetch data",
                });
            }
        });





        app.get('/ideadata/:idone', verifyToken, async (req, res) => {
            const id = req.params.idone;
            // console.log(id);
            const data = await movies.findOne({
                _id: new ObjectId(id)
            });

            res.json(data);

        });
        app.post('/ideadata', verifyToken, async (req, res) => {
            const postData = req.body;
            // console.log(id);
            const data = await movies.insertOne(postData)

            res.json(data);

        });
        app.delete('/idea/:id', verifyToken, async (req, res) => {
            const id = req.params.id;

            const result = await movies.deleteOne({
                _id: new ObjectId(id)
            });

            res.send(result);
        });
        app.patch('/idea/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const updatedData = req.body;

            const result = await movies.updateOne(
                { _id: new ObjectId(id) },
                {
                    $set: updatedData
                }
            );

            res.send(result);
        });

        app.get('/homedata', async (req, res) => {
            const data = await movies.find().limit(6).toArray();
            res.json(data);
        });
        app.post('/comment', verifyToken, async (req, res) => {
            const postData = req.body;
            // console.log(postData);

            const data = await comment.insertOne({
                text: postData.text,
                ideaId: postData.ideaId,
                name: postData.userName,
                email: postData.email,
                createdAt: new Date()
            });

            res.json(data);
        });


        app.get('/comment', async (req, res) => {
            const data = await comment.find().toArray();
            res.json(data)

        })


        app.delete('/comment/:id', verifyToken, async (req, res) => {
            const id = req.params.id;

            const userEmail = req.user.email; // from token

            // check comment belongs to this user
            const commentData = await comment.findOne({
                _id: new ObjectId(id)
            });

            if (!commentData) {
                return res.status(404).send({ message: "This comment can't change you" });
            }

            if (commentData.email !== userEmail) {
                return res.status(403).send({ message: "Forbidden: not your comment" });
            }

            const result = await comment.deleteOne({
                _id: new ObjectId(id)
            });

            res.send(result);
        });


        app.patch('/comment/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const { updatedData } = req.body;

            const userEmail = req.user.email;

            // 1. find comment first
            const existingComment = await comment.findOne({
                _id: new ObjectId(id)
            });

            if (!existingComment) {
                return res.status(404).send({ message: "Comment not found" });
            }

            // 2. check ownership
            if (existingComment.email !== userEmail) {
                return res.status(403).send({ message: "Forbidden: not your comment" });
            }

            // 3. update comment
            const result = await comment.updateOne(
                { _id: new ObjectId(id) },
                { $set: { text: updatedData } }
            );

            res.send(result);
        });

        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {

        // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})
