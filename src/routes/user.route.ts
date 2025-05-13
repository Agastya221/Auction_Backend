import  express from 'express';
import registerUser from '../controllers/user.controller.js';
const Router = express.Router();

Router.post('/register', registerUser);

export default Router;