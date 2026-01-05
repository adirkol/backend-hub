---
name: tailwind-shadcn
description: |
  Tailwind CSS and shadcn/ui component patterns.
  Use when styling components, building layouts, customizing themes, or implementing design systems.
---

# Tailwind CSS + shadcn/ui Skill

Expertise in building beautiful UIs with Tailwind CSS and shadcn/ui components.

## Tailwind Configuration

### Custom Theme
```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui'],
        display: ['var(--font-display)', 'system-ui'],
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        shimmer: 'shimmer 2s infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
```

### CSS Variables
```css
/* app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 240 10% 3.9%;
    --card: 0 0% 100%;
    --card-foreground: 240 10% 3.9%;
    --primary: 262 83% 58%;
    --primary-foreground: 0 0% 100%;
    --secondary: 240 4.8% 95.9%;
    --secondary-foreground: 240 5.9% 10%;
    --muted: 240 4.8% 95.9%;
    --muted-foreground: 240 3.8% 46.1%;
    --accent: 240 4.8% 95.9%;
    --accent-foreground: 240 5.9% 10%;
    --destructive: 0 84% 60%;
    --destructive-foreground: 0 0% 100%;
    --border: 240 5.9% 90%;
    --input: 240 5.9% 90%;
    --ring: 262 83% 58%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 240 10% 3.9%;
    --foreground: 0 0% 98%;
    --card: 240 10% 3.9%;
    --card-foreground: 0 0% 98%;
    --primary: 262 83% 58%;
    --primary-foreground: 0 0% 100%;
    --secondary: 240 3.7% 15.9%;
    --secondary-foreground: 0 0% 98%;
    --muted: 240 3.7% 15.9%;
    --muted-foreground: 240 5% 64.9%;
    --accent: 240 3.7% 15.9%;
    --accent-foreground: 0 0% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 0 0% 98%;
    --border: 240 3.7% 15.9%;
    --input: 240 3.7% 15.9%;
    --ring: 262 83% 58%;
  }
}
```

## Layout Patterns

### Responsive Grid
```tsx
// Responsive card grid
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
  {items.map(item => <Card key={item.id} {...item} />)}
</div>

// Masonry-like with CSS columns
<div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
  {items.map(item => <Card key={item.id} className="break-inside-avoid" {...item} />)}
</div>
```

### Dashboard Layout
```tsx
// Sidebar + main content
<div className="flex min-h-screen">
  {/* Sidebar */}
  <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:border-r bg-card">
    <nav className="flex-1 p-4 space-y-2">
      {/* Nav items */}
    </nav>
  </aside>

  {/* Main content */}
  <main className="flex-1 overflow-y-auto">
    <div className="container py-6">
      {children}
    </div>
  </main>
</div>
```

### Centered Content
```tsx
// Full-screen centered
<div className="min-h-screen flex items-center justify-center p-4">
  <div className="w-full max-w-md">
    {/* Content */}
  </div>
</div>

// Container with max-width
<div className="container mx-auto px-4 py-8 max-w-4xl">
  {children}
</div>
```

## Component Patterns

### Effect Card
```tsx
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function EffectCard({ effect }: { effect: Effect }) {
  return (
    <Card className="group overflow-hidden transition-all hover:shadow-lg hover:shadow-primary/5 hover:border-primary/50">
      {/* Image container with overlay */}
      <div className="relative aspect-square overflow-hidden">
        <Image
          src={effect.preview}
          alt={effect.name}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
        
        {/* Gradient overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        
        {/* Badge */}
        <Badge className="absolute top-2 right-2" variant="secondary">
          {effect.credits} credits
        </Badge>
      </div>

      <CardContent className="p-4">
        <h3 className="font-semibold truncate">{effect.name}</h3>
        <p className="text-sm text-muted-foreground line-clamp-2">
          {effect.description}
        </p>
      </CardContent>

      <CardFooter className="p-4 pt-0">
        <Button className="w-full" size="sm">
          Apply Effect
        </Button>
      </CardFooter>
    </Card>
  );
}
```

### Upload Zone
```tsx
import { Upload, Image as ImageIcon } from 'lucide-react';

export function UploadZone({ onUpload }: { onUpload: (file: File) => void }) {
  const [isDragging, setIsDragging] = useState(false);

  return (
    <div
      className={cn(
        'relative border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer',
        'hover:border-primary hover:bg-primary/5',
        isDragging && 'border-primary bg-primary/10 scale-[1.02]'
      )}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) onUpload(file);
      }}
    >
      <input
        type="file"
        accept="image/*"
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUpload(file);
        }}
      />
      
      <div className="flex flex-col items-center gap-4">
        <div className="p-4 rounded-full bg-primary/10">
          <Upload className="h-8 w-8 text-primary" />
        </div>
        <div>
          <p className="text-lg font-medium">Drop your image here</p>
          <p className="text-sm text-muted-foreground">
            or click to browse
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          PNG, JPG, or WebP up to 10MB
        </p>
      </div>
    </div>
  );
}
```

### Gradient Button
```tsx
import { Button } from '@/components/ui/button';

// Custom gradient button variant
<Button
  className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-600 hover:via-purple-600 hover:to-pink-600 text-white border-0"
>
  Create Effect
</Button>

// Or extend the button component
// components/ui/gradient-button.tsx
import { cn } from '@/lib/utils';
import { Button, type ButtonProps } from './button';

export function GradientButton({ className, ...props }: ButtonProps) {
  return (
    <Button
      className={cn(
        'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500',
        'hover:from-indigo-600 hover:via-purple-600 hover:to-pink-600',
        'text-white border-0 shadow-lg shadow-purple-500/25',
        'transition-all hover:shadow-xl hover:shadow-purple-500/30',
        className
      )}
      {...props}
    />
  );
}
```

## Animation Patterns

### Skeleton Loading
```tsx
function EffectCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="aspect-square bg-muted animate-pulse" />
      <CardContent className="p-4 space-y-2">
        <div className="h-5 bg-muted rounded animate-pulse w-3/4" />
        <div className="h-4 bg-muted rounded animate-pulse w-full" />
        <div className="h-4 bg-muted rounded animate-pulse w-2/3" />
      </CardContent>
    </Card>
  );
}
```

### Shimmer Effect
```tsx
function ShimmerButton() {
  return (
    <Button className="relative overflow-hidden">
      <span className="relative z-10">Processing...</span>
      <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
    </Button>
  );
}
```

### Stagger Animation
```tsx
// With Framer Motion
import { motion } from 'framer-motion';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

function EffectGrid({ effects }) {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="grid grid-cols-4 gap-4"
    >
      {effects.map(effect => (
        <motion.div key={effect.id} variants={item}>
          <EffectCard effect={effect} />
        </motion.div>
      ))}
    </motion.div>
  );
}
```

## Utility Classes

```tsx
// Common utility combinations
const utilities = {
  // Focus ring
  focusRing: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
  
  // Truncate text
  truncate: 'truncate', // Single line
  lineClamp2: 'line-clamp-2', // 2 lines
  
  // Scrollable
  scrollable: 'overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent',
  
  // Glass effect
  glass: 'bg-background/80 backdrop-blur-sm',
  
  // Card hover
  cardHover: 'transition-all hover:shadow-lg hover:shadow-primary/5 hover:border-primary/50 hover:-translate-y-1',
  
  // Gradient text
  gradientText: 'bg-gradient-to-r from-primary to-pink-500 bg-clip-text text-transparent',
};
```






