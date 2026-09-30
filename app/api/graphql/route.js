import { ApolloServer } from '@apollo/server';
import { startServerAndCreateNextHandler } from '@as-integrations/next';
import pkg from 'pg';

const { Pool } = pkg;

// Menggunakan koneksi pool PostgreSQL dari Neon
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// 1. Schema GraphQL
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

// 2. Resolvers
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