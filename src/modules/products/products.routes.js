import { Router } from 'express';
import {
  createProduct,
  patchProduct,
  getProductById,
  listProducts,
} from './products.controller.js';

const r = Router();
r.post('/', createProduct);
r.patch('/:id', patchProduct);
r.get('/:id', getProductById);
r.get('/', listProducts);
export default r;
