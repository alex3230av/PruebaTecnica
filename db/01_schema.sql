-- Charset y engine por defecto
SET NAMES utf8mb4;
SET time_zone = "+00:00";

-- Asegúrate de usar InnoDB (FKs) y utf8mb4
CREATE DATABASE IF NOT EXISTS B2B
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_0900_ai_ci;
USE B2B;

-- CLIENTES
CREATE TABLE IF NOT EXISTS customers (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(255)        NOT NULL,
  email         VARCHAR(255)        NOT NULL,
  phone         VARCHAR(50),
  created_at    TIMESTAMP           NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_customers_email UNIQUE (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- PRODUCTOS
CREATE TABLE IF NOT EXISTS products (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  sku            VARCHAR(100)       NOT NULL,
  name           VARCHAR(255)       NOT NULL,
  price_cents    INT                NOT NULL,
  stock          INT                NOT NULL DEFAULT 0,
  created_at     TIMESTAMP          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_products_sku UNIQUE (sku)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ÓRDENES
CREATE TABLE IF NOT EXISTS orders (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  customer_id   INT                 NOT NULL,
  status        ENUM('CREATED','CONFIRMED','CANCELED') NOT NULL DEFAULT 'CREATED',
  total_cents   INT                 NOT NULL DEFAULT 0,
  created_at    TIMESTAMP           NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_orders_customer
    FOREIGN KEY (customer_id) REFERENCES customers(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  INDEX idx_orders_customer_id (customer_id),
  INDEX idx_orders_status_created_at (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ITEMS DE ORDEN
CREATE TABLE IF NOT EXISTS order_items (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  order_id           INT                 NOT NULL,
  product_id         INT                 NOT NULL,
  qty                INT                 NOT NULL,
  unit_price_cents   INT                 NOT NULL,
  subtotal_cents     INT                 NOT NULL,
  CONSTRAINT fk_items_order
    FOREIGN KEY (order_id) REFERENCES orders(id)
    ON UPDATE RESTRICT ON DELETE CASCADE,
  CONSTRAINT fk_items_product
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  INDEX idx_order_items_order_id (order_id),
  INDEX idx_order_items_product_id (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- IDEMPOTENCIA (guardar resultado de confirmación, etc.)
-- Nota: VARCHAR(191) para llaves con utf8mb4 para evitar problemas de longitud de índice
CREATE TABLE IF NOT EXISTS idempotency_keys (
  `key`            VARCHAR(191)   NOT NULL,
  target_type      VARCHAR(50)    NOT NULL,           -- p.ej. 'ORDER_CONFIRM'
  target_id        INT            NOT NULL,           -- id de la orden, etc.
  status           ENUM('PENDING','DONE','FAILED') NOT NULL DEFAULT 'PENDING',
  response_body    JSON           NULL,
  created_at       TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at       TIMESTAMP      NULL,
  PRIMARY KEY (`key`),
  INDEX idx_idem_target (target_type, target_id),
  INDEX idx_idem_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
