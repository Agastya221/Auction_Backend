import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";


const app = express();
const httpserver = createServer(app);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

const io = new Server(httpserver, {
    cors: {
        origin: "*"
    }
})




httpserver.listen(3000, () => {
    console.log("Server is running on port 3000");
});