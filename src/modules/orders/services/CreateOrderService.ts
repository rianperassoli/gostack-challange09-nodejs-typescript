import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IProductOrder {
  product_id: string;
  price: number;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('customer does not exist');
    }

    const idsOrdered = products.map(product => ({ id: product.id }));

    const productsOrdered = await this.productsRepository.findAllById(
      idsOrdered,
    );

    const productsToOrder: IProductOrder[] = [];
    const newQuantities: IProduct[] = [];

    products.forEach(product => {
      const productFound = productsOrdered.find(
        productOrdered => productOrdered.id === product.id,
      );
      if (!productFound) {
        throw new AppError(`product ${product.id} does not exist`);
      }

      const quantityIsValid = product.quantity <= productFound.quantity;
      if (!quantityIsValid) {
        throw new AppError(
          `the product ${product.id} does not have ${product.quantity} items available`,
        );
      }

      productsToOrder.push({
        product_id: product.id,
        price: productFound.price,
        quantity: product.quantity,
      });

      newQuantities.push({
        id: product.id,
        quantity: productFound.quantity - product.quantity,
      });
    });

    const newOrder = await this.ordersRepository.create({
      customer,
      products: productsToOrder,
    });

    await this.productsRepository.updateQuantity(newQuantities);

    return newOrder;
  }
}

export default CreateOrderService;
