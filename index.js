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

//récupération de l'adresse IP du serveur
const os = require('os');
const ifaces = os.networkInterfaces();
let serverHost = 'localhost';
Object.keys(ifaces).forEach(function (ifname) {
    let alias = 0;

    ifaces[ifname].forEach(function (iface) {
        if ('IPv4' !== iface.family || iface.internal !== false) {
            return;
        }

        if (alias >= 1) {
            serverHost = iface.address;
        } else {
            serverHost = iface.address;
        }
        ++alias;
    });
});

console.log(`Server host: ${serverHost}`);


// Connexion à la base de données MongoDB
try {
    mongoose.connect("mongodb://admin:27fe8999f89c044873dad6885b8a2e18a8108b878e91a8d2@167.71.1.231");
    console.log("Connecté à MongoDB");
} catch (error) {
    console.log("Erreur lors de la connexion à MongoDB :", error);
}

// Moteur de stockage des images
const storage = multer.diskStorage({
    destination: './upload/images',
    filename: (req, file, cb) => {
        return cb(null, `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage: storage
});

// Création de l'endpoint pour les images
app.use("/images", express.static('upload/images'));

app.post("/upload", upload.single('product'), (req, res) => {
    res.json({
        success: 1,
        image_url: `http://${serverHost}:${port}/images/${req.file.filename}`
    });
});

const ProductSchema = new mongoose.Schema({
    id: {
        type: Number,
        required: true,
    },
    name: {
        type: String,
        required: true,
    },
    image: {
        type: String,
        required: true,
    },
    category: {
        type: String,
        required: true,
    },
    subcategories: {
        type: [String],
        required: false,
    },
    new_price: {
        type: Number,
        required: true,
    },
    old_price: {
        type: Number,
        required: false,
    },
    description: {
        type: String,
        required: true,
    },
    tags: {
        type: String,
        required: true,
    },
    date: {
        type: Date,
        default: Date.now,
    },
    available: {
        type: Boolean,
        default: true,
    },
});


//Schéma pour les codes promos
const PromoSchema = new mongoose.Schema({
    id: {
        type: Number,
        required: true,
    },
    code: {
        type: String,
        required: true,
        unique: true,
    },
    discount: {
        type: Number,
        required: true,
    },
    date: {
        type: Date,
        default: Date.now
    },
});

const Product = mongoose.model("Product", ProductSchema);
const Promo = mongoose.model("Promo", PromoSchema);

app.post('/addproduct', async (req, res) => {
    try {
        const products = await Product.find({});
        let id = products.length ? products[products.length - 1].id + 1 : 1;

        const product = new Product({
            id,
            name: req.body.name,
            image: req.body.image,
            category: req.body.category,
            subcategories: req.body.subcategories, // Store subcategories array
            new_price: req.body.new_price,
            old_price: req.body.old_price,
            description: req.body.description,
            tags: req.body.tags,
        });

        await product.save();
        res.json({ success: true, name: req.body.name });
    } catch (error) {
        console.log("Erreur :", error);
        res.status(500).json({ success: false, error: "Échec de l'ajout du produit" });
    }
});


app.post('/removeproduct', async (req, res) => {
    try {
        await Product.findOneAndDelete({ id: req.body.id });
        res.json({
            success: true,
            name: req.body.name,
        });
    } catch (error) {
        console.log("Erreur :", error);
        res.status(500).json({
            success: false,
            error: "Échec de la suppression du produit",
        });
    }
});

app.get('/getproducts', async (req, res) => {
    try {
        const products = await Product.find({});
        res.send(products);
    } catch (error) {
        console.log("Erreur :", error);
        res.status(500).json({
            success: false,
            error: "Échec de la récupération des produits",
        });
    }
});

// Schéma pour le modèle utilisateur
const UserSchema = new mongoose.Schema({
    name: {
        type: String,
    },
    email: {
        type: String,
        unique: true,
    },
    password: {
        type: String,
    },
    cartData: {
        type: Object,
    },
    date: {
        type: Date,
        default: Date.now,
    }
});

const User = mongoose.model('User', UserSchema);

app.post('/signup', async (req, res) => {
    try {
        const check = await User.findOne({ email: req.body.email });
        if (check) {
            return res.status(400).json({ success: false, errors: "Un utilisateur existe déjà avec cette adresse e-mail" });
        }

        const cart = {};
        for (let i = 0; i < 300; i++) {
            cart[i] = 0;
        }

        const user = new User({
            name: req.body.username,
            email: req.body.email,
            password: req.body.password,
            cartData: cart,
        });

        await user.save();

        const data = {
            user: {
                id: user.id,
            }
        };

        const token = jwt.sign(data, "secret_ecom");
        res.json({ success: true, token });
    } catch (error) {
        console.log("Erreur :", error);
        res.status(500).json({
            success: false,
            error: "Échec de l'inscription de l'utilisateur",
        });
    }
});

app.post('/login', async (req, res) => {
    try {
        const user = await User.findOne({ email: req.body.email });
        if (user) {
            const passCompare = req.body.password === user.password;
            if (passCompare) {
                const data = {
                    user: {
                        id: user.id,
                    }
                };
                const token = jwt.sign(data, 'secret_ecom');
                res.json({ success: true, token });
            } else {
                res.status(400).json({ success: false, errors: "Mot de passe incorrect" });
            }
        } else {
            res.status(400).json({ success: false, errors: "Utilisateur introuvable" });
        }
    } catch (error) {
        console.log("Erreur :", error);
        res.status(500).json({
            success: false,
            error: "Échec de la connexion",
        });
    }
});

app.get('/newcollections', async (req, res) => {
    try {
        const products = await Product.find({});
        const newCollection = products.slice(1).slice(-8);
        res.send(newCollection);
    } catch (error) {
        console.log("Erreur :", error);
        res.status(500).json({
            success: false,
            error: "Échec de la récupération de la nouvelle collection",
        });
    }
});

app.get('/popularairsoft', async (req, res) => {
    try {
        const products = await Product.find({ category: "airsoft" });
        const popularInAirsoft = products.slice(0, 4);
        res.send(popularInAirsoft);
    } catch (error) {
        console.log("Erreur :", error);
        res.status(500).json({
            success: false,
            error: "Échec de la récupération des produits populaires airsoft",
        });
    }
});

// Middleware pour récupérer l'utilisateur
const fetchUser = async (req, res, next) => {
    const token = req.header('auth-token');
    if (!token) {
        res.status(401).json({ success: false, errors: "Veuillez vous authentifier" });
    } else {
        try {
            const data = jwt.verify(token, 'secret_ecom');
            req.user = data.user;
            next();
        } catch (error) {
            res.status(401).json({ success: false, errors: "Jeton invalide" });
        }
    }
};

app.post('/addtocart', fetchUser, async (req, res) => {
    try {
        let userData = await User.findOne({ _id: req.user.id });
        userData.cartData[req.body.itemId] += 1;
        await User.findOneAndUpdate({ _id: req.user.id }, { cartData: userData.cartData });
        res.send("Ajouté");
    } catch (error) {
        console.log("Erreur :", error);
        res.status(500).json({
            success: false,
            error: "Échec de l'ajout du produit au panier",
        });
    }
});

app.post('/removefromcart', fetchUser, async (req, res) => {
    try {
        let userData = await User.findOne({ _id: req.user.id });
        if (userData.cartData[req.body.itemId] > 0) {
            userData.cartData[req.body.itemId] -= 1;
        }
        await User.findOneAndUpdate({ _id: req.user.id }, { cartData: userData.cartData });
        res.send("Supprimé");
    } catch (error) {
        console.log("Erreur :", error);
        res.status(500).json({
            success: false,
            error: "Échec de la suppression du produit du panier",
        });
    }
});

app.post('/getcart', fetchUser, async (req, res) => {
    try {
        let userData = await User.findOne({ _id: req.user.id });
        res.json(userData.cartData);
    } catch (error) {
        console.log("Erreur :", error);
        res.status(500).json({
            success: false,
            error: "Échec de la récupération des données du panier",
        });
    }
});

app.post('/getitems', async (req, res) => {
    try {
        const products = await Product.find({ category: req.body.category });
        res.send(products.length.toString());
    } catch (error) {
        console.log("Erreur :", error);
        res.status(500).json({
            success: false,
            error: "Échec de la récupération des articles",
        });
    }
});

app.post('/createpromocode', async (req, res) => {
    try {
        // Check if the promo code already exists
        const existingPromo = await Promo.findOne({ code: req.body.code });
        if (existingPromo) {
            return res.status(400).json({
                success: false,
                error: "Ce code promo existe déjà",
            });
        }

        // Generate new ID for the promo code
        const promos = await Promo.find({});
        let id;
        if (promos.length > 0) {
            const lastPromo = promos[promos.length - 1];
            id = lastPromo.id + 1;
        } else {
            id = 1;
        }

        // Create and save the new promo code
        const promo = new Promo({
            id: id,
            code: req.body.code,
            discount: req.body.discount,
        });

        await promo.save();
        res.json({
            success: true,
            code: req.body.code,
        });
    } catch (error) {
        console.log("Erreur :", error);
        res.status(500).json({
            success: false,
            error: "Échec de la création du code promo",
        });
    }
});

app.post('/removepromocode', async (req, res) => {
    try {
      const promo = await Promo.findOne({ id: req.body.id });
      if (!promo) {
        return res.status(400).json({
          success: false,
          error: "Code promo introuvable",
        });
      }
  
      await Promo.findOneAndDelete({ id: req.body.id });
      res.json({
        success: true,
        id: req.body.id,
      });
    } catch (error) {
      console.log("Erreur :", error);
      res.status(500).json({
        success: false,
        error: "Échec de la suppression du code promo",
      });
    }
  });
  


app.get('/getpromocodes', async (req, res) => {
    try {
        const promos = await Promo.find({});
        res.send(promos);
    } catch (error) {
        console.log("Erreur :", error);
        res.status(500).json({
            success: false,
            error: "Échec de la récupération des codes promo",
        });
    }
});

app.post('/applypromocode', async (req, res) => {
    try {
        const promo = await Promo.findOne({ code: req.body.code });
        if (promo) {
            res.json({
                success: true,
                discount: promo.discount,
            });
        } else {
            res.status(400).json({
                success: false,
                error: "Code promo invalide",
            });
        }
    } catch (error) {
        console.log("Erreur :", error);
        res.status(500).json({
            success: false,
            error: "Échec de l'application du code promo",
        });
    }
});

// Endpoint to get all subcategories
app.get('/getsubcategories', async (req, res) => {
    try {
      const products = await Product.find({});
      const subcategories = [...new Set(products.flatMap(product => product.subcategories))];
      res.json(subcategories);
    } catch (error) {
      console.log("Erreur :", error);
      res.status(500).json({
        success: false,
        error: "Échec de la récupération des sous-catégories",
      });
    }
  });
  

app.listen(port, (error) => {
    if (!error) {
        console.log(`Le serveur fonctionne sur le port ${port}`);
    } else {
        console.log(`Erreur : ${error}`);
    }
});
