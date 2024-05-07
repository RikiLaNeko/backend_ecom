const port = 4000;
const express = require('express');
const app = express();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const { log } = require('console');

app.use(express.json());
app.use(cors());

//Database connection with MongoDB
mongoose.connect("mongodb://admin:27fe8999f89c044873dad6885b8a2e18a8108b878e91a8d2@167.71.1.231");

//Api Creation
app.get("/", (req,res)=>{
    res.send("Express API is running");
})

// Image Storage Engine
const Storage = multer.diskStorage({
    destination: './upload/images',
    filename: (req,file,cb)=>{
        return cb(null, `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`);
    }
})

const upload = multer({
    storage: Storage
})

//Creating Upload Endpoint for images
app.use("/images", express.static('upload/images'))

app.post("/upload",upload.single('product'),(req,res)=>{
    res.json({
        success: 1,
        image_url: `http://localhost:${port}/images/${req.file.filename}`
    })
})

//Schema for Creating Products
const Products = mongoose.model("Product",{
    id:{
        type : Number,
        required: true,
    },
    name:{
        type:String,
        required: true,
    },
    image:{
        type:String,
        required: true,
    },
    category:{
        type:String,
        require:true,
    },
    new_price:{
        type: Number,
        required: true,
    },
    old_price:{
        type:Number,
        required: true,
    },
    date:{
        type:Date,
        default:Date.now
    },
    available:{
        type:Boolean,
        default:true
    },
})

app.post('/addproduct', async(req,res)=>{
    try {
        let products = await Products.find({});
        let id;
        if(products.length>0){
            let last_product_array = products.slice(-1);
            let last_product = last_product_array[0];
            id = last_product.id+1;
        }
        else{
            id = 1;
        }

        const product = new Products({
            id: id,
            name: req.body.name,
            image: req.body.image,
            category: req.body.category,
            new_price: req.body.new_price,
            old_price: req.body.old_price,
        });
        console.log(product);
        await product.save();
        console.log("Saved");
        res.json({
            success:true,
            name:req.body.name,
        });
    } catch (error) {
        console.log("Error:", error);
        res.status(500).json({
            success: false,
            error: "Failed to add product",
        });
    }
})



//Creating API for deleting products
app.post('/removeproduct', async(req,res)=>{
    try {
        await Products.findOneAndDelete({id:req.body.id});
        console.log("Removed");
        res.json({
            success: true,
            name: req.body.name,
        });
    } catch (error) {
        console.log("Error:", error);
        res.status(500).json({
            success: false,
            error: "Failed to remove product",
        });
    }
})

//Creating API for getting all products
app.get('/getproducts', async(req,res)=>{
    try {
        let products = await Products.find({});
        console.log("All Products Fetched");
        res.send(products);
    } catch (error) {
        console.log("Error:", error);
        res.status(500).json({
            success: false,
            error: "Failed to fetch products",
        });
    }
})

//Schema for user model

const Users = mongoose.model('Users',{
    name:{
        type: String,
    },

    email:{
        type: String,
        unique: true,
    },

    password:{
        type: String,
    },

    cartData:{
        type: Object,
    },

    date:{
        type: Date,
        default: Date.now,
    }

})

// Creating Endpoints for registering user
app.post('/signup', async(req,res)=>{

    let check = await Users.findOne({email:req.body.email});
    if(check){
        return res.status(400).json({success:false, errors:"existing user found with this same email address"});
    }
    let cart= {};
    for (let i = 0; i < 300; i++) {
        cart[i] = 0;        
    }

    const user= new Users({
        username: req.body.username,
        email: req.body.email,
        password: req.body.password,
        cartData: cart,
    });

    await user.save();

    const data ={
        user:{
            id: user.id,
        }
    }

    const token = jwt.sign(data, "secret_ecom");
    res.json({success:true, token});

})

// Creating endpoint for user login
app.post('/login', async(req,res)=>{
    let user = await Users.findOne({email:req.body.email});
    if(user){
        const passCompare = req.body.password === user.password;
        if (passCompare) {
            const data ={
                user:{
                    id: user.id,
                }
            }
            const token = jwt.sign(data,'secret_ecom');
            res.json({success:true, token});
        }
        else{
            res.status(400).json({success:false, errors:"Invalid Password"});
        }
    }
    else{
        res.status(400).json({success:false, errors:"User not found"});
    }
})

// creating endpoint for newcollection data
app.get('/newcollections', async(req,res)=>{
    let product = await Products.find({});
    let newcollection = product.slice(1).slice(-8);
    console.log("New Collection Fetched");
    res.send(newcollection);
})

// Creating endpoint for popular in women section
app.get('/popularwomen', async(req,res)=>{
    let product = await Products.find({category:"women"});
    let popular_in_women = product.slice(0,4);
    console.log("Popular in women fetched");
    res.send(popular_in_women);
})

//Creating middleware to fetch user
const fetchUser = async (req,res,next) => {
    const token = req.header('auth-token');
    if (!token) {
        res.status(401).json({success:false, errors:"Please Authenticate"});
    }else{
        try {
            const data = jwt.verify(token,'secret_ecom');
            req.user = data.user;
            next();
        } catch (error) {
            res.status(401).json({success:false, errors:"Invalid Token"});
        }
    }
}
//Creating endpoint for adding product in cartdata
app.post('/addtocart', fetchUser, async(req,res)=>{
    console.log("added", req.body.itemId)
    let userData = await Users.findOne({_id:req.user.id});
    userData.cartData[req.body.itemId] += 1;
    await Users.findOneAndUpdate({_id:req.user.id},{cartData:userData.cartData});
    console.log("Added to cart" , userData.cartData[req.body.itemId]);
    res.send("Added")
})

//Creating endpoint for removing product from cartdata
app.post('/removefromcart', fetchUser, async(req,res)=>{
    console.log("removeed", req.body.itemId);
    let userData = await Users.findOne({_id:req.user.id});
    if(userData.cartData[req.body.itemId] >0)
    userData.cartData[req.body.itemId] -= 1;
    await Users.findOneAndUpdate({_id:req.user.id},{cartData:userData.cartData});
    console.log("Removed from cart");
    res.send("Removed");
})

// Creating endpoint for getting cartdata
app.post('/getcart', fetchUser, async(req,res)=>{
    console.log("Cart Data Fetched");
    let userData = await Users.findOne({_id:req.user.id});
    res.json(userData.cartData);
})

app.listen(port,(error)=>{
    if(!error){
        console.log(`Server is running on port ${port}`);
    }
    else{
        console.log(`Error: ${error}`);
    }
});
