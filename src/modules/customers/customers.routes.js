import { Router } from "express";
import {
    createCustomer,
    getCustomerById,
    listCustomers,
    updateCustomer,
    deleteCustomer,
    getInternalCustomerById,
} from "./customers.controller.js";
import { requireServiceToken } from '../../middlewares/auth.js';

const router = Router();

router.post('/', createCustomer);          
router.get('/:id', getCustomerById); 
router.get('/', listCustomers);
router.put('/:id', updateCustomer); 
router.delete('/:id', deleteCustomer);


export const internalRouter = Router();
internalRouter.get('/customers/:id', requireServiceToken, getInternalCustomerById);

export default router;