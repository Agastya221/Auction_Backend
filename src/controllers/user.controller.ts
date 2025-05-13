import { Request, Response } from "express";
import prisma from "../utils/Prisma";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";


interface User {
  username: string;
  email: string;
  password: string;
}


const registerUser = async(req:Request, res:Response): Promise<void> => {
 try {
    const { username, email, password } = req.body as User; 
      const user = await prisma.user.findUnique({
        where:{
          email: email
        }
      })
      const hashedPassword = await bcrypt.hash(password, 10)
      if(user){
        res.status(400).json({message: "User already exists"})
        return;
      }
      const newUser = await prisma.user.create({
        data:{
          username: username,
          email: email,
          password: hashedPassword
        }
      })
    
      res.status(201).json({ message: "User created successfully", user: newUser });
      return;

 } catch (error) {
    res.status(500).json({ message: "Internal server error", error });
    return;
 }



}

const loginUser = async(req:Request, res:Response): Promise<void> => {
  try {
    const { email, password } = req.body as User; 
    const user = await prisma.user.findUnique({
      where:{
        email: email
      }
    })
    if(!user){
      res.status(400).json({message: "User does not exist"})
      return;
    }
    const isPasswordValid = await bcrypt.compare(password, user.password)
    if(!isPasswordValid){
      res.status(400).json({message: "Invalid password"})
      return;
    }
    const token = jwt.sign({id: user.id}, process.env.JWT_SECRET as string, {expiresIn: "1h"})
    
    res.status(200).json({ message: "User logged in successfully", user });
  } catch (error) {
    res.status(500).json({ message: "Internal server error", error });
  }
}

export default registerUser;