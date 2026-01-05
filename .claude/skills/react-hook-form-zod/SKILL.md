---
name: react-hook-form-zod
description: |
  React Hook Form with Zod validation patterns.
  Use when building forms, implementing validation, handling form state, or creating reusable form components.
---

# React Hook Form + Zod Skill

Expertise in building type-safe, validated forms with React Hook Form and Zod.

## Basic Setup

### Schema Definition
```typescript
// schemas/effect.ts
import { z } from 'zod';

export const createEffectSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(50, 'Name must be less than 50 characters'),
  category: z.enum(['vintage', 'modern', 'artistic', 'fun'], {
    required_error: 'Please select a category',
  }),
  intensity: z
    .number()
    .min(0, 'Intensity must be at least 0')
    .max(100, 'Intensity must be at most 100')
    .default(50),
  isPublic: z.boolean().default(false),
});

export type CreateEffectInput = z.infer<typeof createEffectSchema>;
```

### Form Component
```tsx
// components/forms/create-effect-form.tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createEffectSchema, type CreateEffectInput } from '@/schemas/effect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';

interface CreateEffectFormProps {
  onSubmit: (data: CreateEffectInput) => Promise<void>;
}

export function CreateEffectForm({ onSubmit }: CreateEffectFormProps) {
  const form = useForm<CreateEffectInput>({
    resolver: zodResolver(createEffectSchema),
    defaultValues: {
      name: '',
      category: undefined,
      intensity: 50,
      isPublic: false,
    },
  });

  const handleSubmit = async (data: CreateEffectInput) => {
    try {
      await onSubmit(data);
      form.reset();
    } catch (error) {
      form.setError('root', {
        message: 'Failed to create effect. Please try again.',
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Text Input */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Effect Name</FormLabel>
              <FormControl>
                <Input placeholder="My awesome effect" {...field} />
              </FormControl>
              <FormDescription>
                Give your effect a unique name.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Select */}
        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="vintage">Vintage</SelectItem>
                  <SelectItem value="modern">Modern</SelectItem>
                  <SelectItem value="artistic">Artistic</SelectItem>
                  <SelectItem value="fun">Fun</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Slider */}
        <FormField
          control={form.control}
          name="intensity"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Intensity: {field.value}%</FormLabel>
              <FormControl>
                <Slider
                  min={0}
                  max={100}
                  step={1}
                  value={[field.value]}
                  onValueChange={(value) => field.onChange(value[0])}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Switch */}
        <FormField
          control={form.control}
          name="isPublic"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between">
              <div>
                <FormLabel>Make Public</FormLabel>
                <FormDescription>
                  Allow others to use this effect.
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        {/* Root Error */}
        {form.formState.errors.root && (
          <div className="text-sm text-red-500">
            {form.formState.errors.root.message}
          </div>
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? 'Creating...' : 'Create Effect'}
        </Button>
      </form>
    </Form>
  );
}
```

## Advanced Patterns

### File Upload Validation
```typescript
// schemas/upload.ts
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const uploadSchema = z.object({
  image: z
    .custom<File>()
    .refine((file) => file instanceof File, 'Please upload a file')
    .refine((file) => file.size <= MAX_FILE_SIZE, 'File must be less than 10MB')
    .refine(
      (file) => ACCEPTED_IMAGE_TYPES.includes(file.type),
      'Only .jpg, .png, and .webp files are accepted'
    ),
});

// Usage in form
<FormField
  control={form.control}
  name="image"
  render={({ field: { onChange, value, ...field } }) => (
    <FormItem>
      <FormLabel>Upload Image</FormLabel>
      <FormControl>
        <Input
          type="file"
          accept="image/*"
          onChange={(e) => onChange(e.target.files?.[0])}
          {...field}
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

### Dynamic Form Arrays
```typescript
// schemas/batch.ts
export const batchEffectSchema = z.object({
  effects: z.array(
    z.object({
      imageUrl: z.string().url(),
      effectId: z.string(),
    })
  ).min(1, 'Add at least one effect'),
});

// Component
import { useFieldArray } from 'react-hook-form';

function BatchEffectForm() {
  const form = useForm({
    resolver: zodResolver(batchEffectSchema),
    defaultValues: { effects: [{ imageUrl: '', effectId: '' }] },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'effects',
  });

  return (
    <form>
      {fields.map((field, index) => (
        <div key={field.id} className="flex gap-4">
          <FormField
            control={form.control}
            name={`effects.${index}.imageUrl`}
            render={({ field }) => (
              <Input placeholder="Image URL" {...field} />
            )}
          />
          <Button type="button" onClick={() => remove(index)}>
            Remove
          </Button>
        </div>
      ))}
      <Button
        type="button"
        onClick={() => append({ imageUrl: '', effectId: '' })}
      >
        Add Effect
      </Button>
    </form>
  );
}
```

### Conditional Validation
```typescript
export const effectSettingsSchema = z.object({
  type: z.enum(['basic', 'advanced']),
  // Only required when type is 'advanced'
  advancedConfig: z.object({
    parameter1: z.number(),
    parameter2: z.number(),
  }).optional(),
}).refine(
  (data) => {
    if (data.type === 'advanced') {
      return data.advancedConfig !== undefined;
    }
    return true;
  },
  {
    message: 'Advanced config is required for advanced type',
    path: ['advancedConfig'],
  }
);
```

### Server Action Integration
```typescript
// app/actions/effect.ts
'use server';

import { z } from 'zod';
import { createEffectSchema } from '@/schemas/effect';

export async function createEffect(formData: FormData) {
  const rawData = {
    name: formData.get('name'),
    category: formData.get('category'),
    intensity: Number(formData.get('intensity')),
    isPublic: formData.get('isPublic') === 'on',
  };

  const result = createEffectSchema.safeParse(rawData);

  if (!result.success) {
    return {
      success: false,
      errors: result.error.flatten().fieldErrors,
    };
  }

  // Create effect in database
  const effect = await prisma.effect.create({
    data: result.data,
  });

  return { success: true, data: effect };
}

// Using with form
'use client';

import { useFormState } from 'react-dom';
import { createEffect } from '@/app/actions/effect';

function CreateEffectForm() {
  const [state, formAction] = useFormState(createEffect, null);

  return (
    <form action={formAction}>
      <input name="name" />
      {state?.errors?.name && <p>{state.errors.name}</p>}
      <button type="submit">Create</button>
    </form>
  );
}
```

## Common Validation Patterns

```typescript
// Email
email: z.string().email('Invalid email address'),

// Password with requirements
password: z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[0-9]/, 'Password must contain a number'),

// Confirm password
confirmPassword: z.string(),
// Then use .refine() at object level

// URL
url: z.string().url('Invalid URL'),

// Phone (basic)
phone: z.string().regex(/^\+?[\d\s-()]+$/, 'Invalid phone number'),

// Date
date: z.coerce.date(),

// Optional with transform
nickname: z.string().optional().transform(val => val || undefined),

// Array with constraints
tags: z.array(z.string()).min(1).max(5),

// Enum from const
const CATEGORIES = ['a', 'b', 'c'] as const;
category: z.enum(CATEGORIES),
```






