import { ApolloServer } from '@apollo/server';
import { startServerAndCreateNextHandler } from '@as-integrations/next';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import jwt from 'jsonwebtoken';
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
    // 1. Create Product (DILINDUNGI OAUTH2)
    createProduct: async (_, { input }, context) => {
      // Pengecekan Token JWT
      if (!context.user) {
        throw new Error('Unauthorized: silakan login terlebih dahulu');
      }

      const result = await pool.query(
        'INSERT INTO products (name, price, stock, category_id) VALUES ($1, $2, $3, $4) RETURNING *',
        [input.name, input.price, input.stock, input.categoryId]
      );
      return result.rows[0];
    },
    
    // 2. Update Product
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

// 3. Inisialisasi Apollo Server (Ubah bagian ini)
const server = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: true,
  plugins: [
    ApolloServerPluginLandingPageLocalDefault({ embed: true }),
  ],
});

// 4. Setup Handler dengan Context untuk Verifikasi JWT (Cukup dipanggil SEKALI saja)
const handler = startServerAndCreateNextHandler(server, {
  context: async (req) => {
    // Ambil header Authorization dari request Next.js App Router
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    
    try {
      // Verifikasi token JWT
      const user = jwt.verify(token, process.env.JWT_SECRET);
      return { user };
    } catch (err) {
      // Jika tidak ada token atau token salah/kadaluarsa
      return { user: null };
    }
  },
});

export { handler as GET, handler as POST };