# Overview

SmartCart is an intelligent shopping experience application built as a full-stack web application using React, Express, and PostgreSQL. The system provides barcode scanning functionality, shopping cart management, and integrated payment processing through Stripe. Users can authenticate via Replit OAuth, scan product barcodes to add items to their cart, and complete purchases with secure payment processing.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens and CSS variables
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Form Handling**: React Hook Form with Zod validation

## Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database ORM**: Drizzle ORM for type-safe database operations
- **API Design**: RESTful API with standardized error handling and request logging
- **Authentication**: Passport.js with OpenID Connect strategy for Replit OAuth
- **Session Management**: Express sessions with PostgreSQL storage using connect-pg-simple

## Data Storage
- **Primary Database**: PostgreSQL accessed via Neon serverless connection
- **Schema Management**: Drizzle Kit for migrations and schema versioning
- **Session Storage**: PostgreSQL table for persistent user sessions
- **Database Schema**: 
  - Users table with Stripe integration fields
  - Products table with barcode scanning support
  - Shopping carts and cart items with relationships
  - Orders table for purchase history

## Authentication & Authorization
- **OAuth Provider**: Replit OAuth using OpenID Connect
- **Session Strategy**: Server-side sessions with PostgreSQL persistence
- **Authorization Pattern**: Middleware-based route protection with user context
- **User Management**: Automatic user creation/update on OAuth login

## Payment Processing
- **Payment Provider**: Stripe integration for secure payment processing
- **Payment Flow**: Payment Intent creation with client-side confirmation
- **Stripe Elements**: React Stripe.js for secure payment form handling
- **Order Management**: Order tracking with payment status updates

# External Dependencies

## Core Services
- **Neon Database**: Serverless PostgreSQL hosting with connection pooling
- **Stripe**: Payment processing with subscription and customer management
- **Replit OAuth**: Authentication provider using OpenID Connect protocol

## Frontend Libraries
- **shadcn/ui**: Pre-built accessible UI components based on Radix UI
- **Radix UI**: Headless UI primitives for complex interactions
- **TanStack Query**: Server state synchronization and caching
- **Stripe React**: Official Stripe components for payment forms
- **Lucide React**: Icon library for consistent iconography

## Backend Libraries
- **Drizzle ORM**: Type-safe database operations with PostgreSQL dialect
- **Passport.js**: Authentication middleware with OAuth strategy support
- **Express Session**: Session management with PostgreSQL store
- **Zod**: Runtime type validation for API requests and responses

## Development Tools
- **TypeScript**: Static type checking across frontend and backend
- **Vite**: Fast development server and optimized production builds
- **ESBuild**: Fast bundling for production server deployment
- **Tailwind CSS**: Utility-first CSS framework with custom design system