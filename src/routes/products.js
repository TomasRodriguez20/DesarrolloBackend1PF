import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import Product from '../models/product.js'; 
const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const productsFile = path.join(__dirname, '../data/productos.json');

export const getProducts = async () => {
  try {
    const products = await Product.find();
    console.log('Productos cargados desde la base de datos:', products);
    return products;
  } catch (error) {
    console.error('Error al obtener productos:', error);
    throw error; 
  }
};

export const getProductById = async (id) => {
  try {
      return await Product.findById(id).lean(); 
  } catch (error) {
      console.error('Error al obtener el producto:', error);
      return null;
  }
};

export const saveProducts = async (products) => {
  await fs.writeFile(productsFile, JSON.stringify(products, null, 2));
};

router.get('/', async (req, res) => {
  try {
    const { limit = 10, page = 1, sort = '', query = '', category = '', stock = '' } = req.query;

    const filter = {};

    if (category) {
      filter.category = category.toLowerCase(); 
    }

    if (query) {
      filter.title = { $regex: query, $options: 'i' }; 
    }

    if (stock) {
      if (stock === 'disponible') {
        filter.stock = { $gt: 0 }; 
      } else if (stock === 'agotado') {
        filter.stock = 0; 
      }
    }

    const sortOption = {};
    if (sort) {
      sortOption.price = sort === 'asc' ? 1 : -1; 
    }

    const skip = (parseInt(page) - 1) * parseInt(limit); 
    const products = await Product.find(filter) 
      .sort(sortOption)
      .skip(skip)
      .limit(parseInt(limit));

    const totalProducts = await Product.countDocuments(filter);
    const totalPages = Math.ceil(totalProducts / limit);

    res.json({
      status: 'success',
      payload: products,
      totalPages,
      prevPage: page > 1 ? page - 1 : null,
      nextPage: page < totalPages ? parseInt(page) + 1 : null,
      page: parseInt(page),
      hasPrevPage: page > 1,
      hasNextPage: page < totalPages,
      prevLink: page > 1 ? `/api/products?limit=${limit}&page=${page - 1}&sort=${sort}&query=${query}&category=${category}&stock=${stock}` : null,
      nextLink: page < totalPages ? `/api/products?limit=${limit}&page=${parseInt(page) + 1}&sort=${sort}&query=${query}&category=${category}&stock=${stock}` : null
    });
  } catch (error) {
    console.error('Error al obtener productos:', error);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
});





router.get('/:pid', async (req, res) => {
  try {
    const products = await getProducts();
    const product = products.find(p => p.id === req.params.pid);
    if (product) {
      res.json(product);
    } else {
      res.status(404).json({ error: 'Producto no encontrado' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener el producto' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { title, description, code, price, status = true, stock, category, thumbnails = [] } = req.body;
    if (!title || !description || !code || !price || !stock || !category) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios excepto thumbnails' });
    }

    const products = await getProducts();
    const newId = products.length > 0 ? String(Number(products[products.length - 1].id) + 1) : '1';
    const newProduct = { id: newId, title, description, code, price, status, stock, category, thumbnails };
    products.push(newProduct);

    await saveProducts(products);
    req.app.get('io').emit('newProduct', newProduct);
    res.status(201).json(newProduct);
  } catch (error) {
    res.status(500).json({ error: 'Error al agregar el producto' });
  }
});

router.delete('/:pid', async (req, res) => {
  try {
    const products = await getProducts();
    const newProducts = products.filter(p => p.id !== req.params.pid);

    if (newProducts.length === products.length) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    await saveProducts(newProducts);
    req.app.get('io').emit('productDeleted', req.params.pid);
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar el producto' });
  }
});

router.get('/init', async (req, res) => {
  try {
    const products = await getProducts();
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener productos iniciales' });
  }
});

export default router;
