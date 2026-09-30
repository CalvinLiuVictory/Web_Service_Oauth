import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import pkg from 'pg';
import dotenv from 'dotenv';

// Load environment variables dari file .env
dotenv.config();

const { Pool } = pkg;

// Setup koneksi PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// 1. Definisi Schema (typeDefs)
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

  type Query {
    categories: [Category!]!
    products: [Product!]!
    product(id: ID!): Product
  }
`;

// 2. Definisi Resolvers
const resolvers = {
  Query: {
    categories: async () => {
      const result = await pool.query('SELECT * FROM categories');
      return result.rows;
    },
    products: async () => {
      const result = await pool.query('SELECT * FROM products');
      return result.rows;
    },
    product: async (_, { id }) => {
      const result = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
      return result.rows[0];
    }
  },
  // Resolver untuk Nested Query (Produk ke Kategori)
  Product: {
    category: async (parent) => {
      const result = await pool.query('SELECT * FROM categories WHERE id = $1', [parent.category_id]);
      return result.rows[0];
    }
  },
  // Resolver untuk Nested Query (Kategori ke Produk)
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
  // introspection diset true agar dosen bisa mengakses lewat Apollo Sandbox setelah di-deploy
  introspection: true, 
});

// 4. Jalankan Server
const { url } = await startStandaloneServer(server, {
  listen: { port: process.env.PORT || 4000 },
});

console.log(`🚀 GraphQL Server ready at: ${url}`);