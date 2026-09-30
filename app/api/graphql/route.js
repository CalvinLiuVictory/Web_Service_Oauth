import { ApolloServer } from '@apollo/server';
import { startServerAndCreateNextHandler } from '@as-integrations/next';
import pkg from 'pg';

const { Pool } = pkg;

// Menggunakan koneksi pool PostgreSQL dari Neon
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// 1. Schema GraphQL (TypeDefs)
const typeDefs = `#graphql
  type Category {
    id: ID!
    name: String!
    products: [Product!]!
  }

  type Product {
    id: ID!
    name: String!
    price: Float!
    stock: Int!
    category: Category!
  }

  # Input Types untuk Mutation
  input CreateProductInput {
    name: String!
    price: Float!
    stock: Int!
    categoryId: ID!
  }

  input UpdateProductInput {
    name: String
    price: Float
    stock: Int
  }

  # Query dengan Filter opsional (categoryId)
  type Query {
    categories: [Category!]!
    products(categoryId: ID): [Product!]!
    product(id: ID!): Product
  }

  # Mutation (Create, Update, Delete)
  type Mutation {
    createProduct(input: CreateProductInput!): Product!
    updateProduct(id: ID!, input: UpdateProductInput!): Product!
    deleteProduct(id: ID!): Boolean!
  }
`;

// 2. Resolvers
const resolvers = {
  Query: {
    categories: async () => {
      const result = await pool.query('SELECT * FROM categories');
      return result.rows;
    },
    // Filter produk berdasarkan categoryId jika diberikan
    products: async (_, { categoryId }) => {
      if (categoryId) {
        const result = await pool.query('SELECT * FROM products WHERE category_id = $1', [categoryId]);
        return result.rows;
      }
      const result = await pool.query('SELECT * FROM products');
      return result.rows;
    },
    product: async (_, { id }) => {
      const result = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
      return result.rows[0];
    }
  },
  Mutation: {
    // 1. Create Product
    createProduct: async (_, { input }) => {
      const result = await pool.query(
        'INSERT INTO products (name, price, stock, category_id) VALUES ($1, $2, $3, $4) RETURNING *',
        [input.name, input.price, input.stock, input.categoryId]
      );
      return result.rows[0];
    },
    // 2. Update Product (Menggunakan COALESCE agar field opsional yang kosong tidak menimpa data)
    updateProduct: async (_, { id, input }) => {
      const result = await pool.query(
        'UPDATE products SET name = COALESCE($1, name), price = COALESCE($2, price), stock = COALESCE($3, stock) WHERE id = $4 RETURNING *',
        [input.name, input.price, input.stock, id]
      );
      return result.rows[0];
    },
    // 3. Delete Product
    deleteProduct: async (_, { id }) => {
      await pool.query('DELETE FROM products WHERE id = $1', [id]);
      return true;
    }
  },
  // Relasi Nested Query
  Product: {
    category: async (parent) => {
      const result = await pool.query('SELECT * FROM categories WHERE id = $1', [parent.category_id]);
      return result.rows[0];
    }
  },
  Category: {
    products: async (parent) => {
      const result = await pool.query('SELECT * FROM products WHERE category_id = $1', [parent.id]);
      return result.rows;
    }
  }
};

// 3. Inisialisasi Apollo Server
const server = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: true,
});

const handler = startServerAndCreateNextHandler(server);

export { handler as GET, handler as POST };