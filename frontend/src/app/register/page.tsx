"use client";

import Link from "next/link";
import { useForm, ControllerRenderProps } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Loader2,
  ArrowRight,
  Check,
  LockIcon,
  UserIcon,
  MailIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Typography } from "@/components/ui/typography";
import { useDemoAuth } from "@/hooks/use-demo-auth";

// Form validation schema
const registerSchema = z
  .object({
    name: z.string().min(2, { message: "Name must be at least 2 characters" }),
    email: z.string().email({ message: "Please enter a valid email address" }),
    password: z
      .string()
      .min(6, { message: "Password must be at least 6 characters" }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const { register, isLoading } = useDemoAuth();

  // Initialize form
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  // Handle form submission
  const onSubmit = async (values: RegisterFormValues) => {
    try {
      await register(values.name, values.email, values.password);
    } catch (error) {
      toast.error("Registration failed", {
        description:
          error instanceof Error ? error.message : "Please try again later.",
        duration: 5000,
      });
    }
  };

  return (
    <div className="flex items-center justify-center w-full min-h-screen bg-black text-foreground relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-background/90 to-background/70"></div>
        <div className="absolute top-0 left-0 right-0 h-[500px] bg-gradient-radial from-blue-500/10 via-background/0 to-background/0"></div>

        {/* Logo pattern background */}
        <div className="absolute inset-0 opacity-[0.03] overflow-hidden">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="absolute opacity-30"
              style={{
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                transform: `rotate(${Math.random() * 360}deg) scale(${
                  0.5 + Math.random() * 1.5
                })`,
              }}
            >
              <div className="text-6xl font-bold">CS</div>
            </div>
          ))}
        </div>

        {/* Animated dots */}
        <div className="particles-container">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className={`absolute w-1 h-1 rounded-full bg-primary/30 animate-floating`}
              style={{
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                animationDuration: `${6 + Math.random() * 10}s`,
                animationDelay: `${Math.random() * 5}s`,
              }}
            ></div>
          ))}
        </div>

        {/* Gradient orbs */}
        <div className="absolute top-1/3 right-1/4 w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-1/3 left-1/4 w-[400px] h-[400px] bg-indigo-600/5 rounded-full blur-[100px]"></div>

        {/* Curved lines */}
        <svg
          className="absolute inset-0 w-full h-full opacity-[0.07]"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <path
            d="M0,50 C20,30 50,70 100,50"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.5"
          />
          <path
            d="M0,30 C30,50 70,20 100,40"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.5"
          />
          <path
            d="M0,70 C30,60 70,80 100,70"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.5"
          />
        </svg>

        {/* Grid lines */}
        <div className="grid-lines absolute inset-0 opacity-10"></div>
      </div>

      <div className="w-full max-w-md px-4 sm:px-0 z-10 fade-in my-10">
        <Card className="border-primary/10 shadow-2xl bg-card/60 backdrop-blur-lg">
          <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent"></div>
          <div className="absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent"></div>

          <CardHeader className="space-y-2 pb-4">
            <div className="flex justify-center">
              <div className="flex items-center gap-3 mb-2 group">
                <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-2xl transition-all duration-300 relative overflow-hidden group-hover:blue-glow">
                  CS
                  <div className="absolute inset-0 bg-white/20 transform translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
                </div>
                <Typography
                  variant="h3"
                  className="text-2xl font-bold gradient-glow"
                >
                  CodeSquare
                </Typography>
              </div>
            </div>

            <CardTitle className="text-2xl font-bold text-center">
              Create Your Account
            </CardTitle>
            <CardDescription className="text-center">
              Sign up for a free trading account with $10,000 virtual funds
            </CardDescription>
          </CardHeader>

          <CardContent className="pb-4">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({
                    field,
                  }: {
                    field: ControllerRenderProps<RegisterFormValues, "name">;
                  }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1.5">
                        <UserIcon className="h-3.5 w-3.5 text-primary/80" />
                        Full Name
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="John Doe"
                          autoComplete="name"
                          disabled={isLoading}
                          className="border-blue-500/20 focus:border-blue-500/40 bg-card/70 backdrop-blur-sm rounded-md"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({
                    field,
                  }: {
                    field: ControllerRenderProps<RegisterFormValues, "email">;
                  }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1.5">
                        <MailIcon className="h-3.5 w-3.5 text-primary/80" />
                        Email
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="your.email@example.com"
                          type="email"
                          autoComplete="email"
                          disabled={isLoading}
                          className="border-blue-500/20 focus:border-blue-500/40 bg-card/70 backdrop-blur-sm rounded-md"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({
                    field,
                  }: {
                    field: ControllerRenderProps<
                      RegisterFormValues,
                      "password"
                    >;
                  }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1.5">
                        <LockIcon className="h-3.5 w-3.5 text-primary/80" />
                        Password
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="••••••••"
                          type="password"
                          autoComplete="new-password"
                          disabled={isLoading}
                          className="border-blue-500/20 focus:border-blue-500/40 bg-card/70 backdrop-blur-sm rounded-md"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({
                    field,
                  }: {
                    field: ControllerRenderProps<
                      RegisterFormValues,
                      "confirmPassword"
                    >;
                  }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1.5">
                        <LockIcon className="h-3.5 w-3.5 text-primary/80" />
                        Confirm Password
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="••••••••"
                          type="password"
                          autoComplete="new-password"
                          disabled={isLoading}
                          className="border-blue-500/20 focus:border-blue-500/40 bg-card/70 backdrop-blur-sm rounded-md"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="mt-5 mb-2 py-4 px-5 border border-primary/20 rounded-xl bg-gradient-to-br from-primary/10 to-transparent backdrop-blur-sm shadow-inner">
                  <Typography
                    variant="small"
                    className="text-primary font-medium mb-3 flex items-center gap-2"
                  >
                    <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-primary"></div>
                    </div>
                    <span>Account Benefits</span>
                  </Typography>
                  <div className="space-y-3">
                    <BenefitItem text="$10,000 in virtual trading funds" />
                    <BenefitItem text="Access to all trading pairs" />
                    <BenefitItem text="Advanced charting and analysis tools" />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full relative overflow-hidden group bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 hover:shadow-lg hover:shadow-blue-500/20 transition-all duration-300 mt-3"
                  disabled={isLoading}
                  onClick={() => {
                    if (!form.formState.isValid) {
                      toast.error("Please check your inputs", {
                        description: "Some fields require your attention",
                        duration: 3000,
                      });
                    }
                  }}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    <>
                      <span className="relative z-10 flex items-center justify-center">
                        Create Free Account
                        <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </span>
                      <span className="absolute inset-0 bg-white/10 transform translate-y-full group-hover:translate-y-0 transition-transform duration-300"></span>
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>

          <CardFooter className="flex flex-col space-y-3 pt-0">
            <div className="text-center text-sm">
              <span className="text-muted-foreground">
                Already have an account?{" "}
              </span>
              <Link
                href="/login"
                className="text-primary underline-offset-4 hover:underline"
              >
                Log In
              </Link>
            </div>
            <Typography
              variant="small"
              className="text-center text-muted-foreground text-xs"
            >
              By registering, you agree to our Terms of Service and Privacy
              Policy.
            </Typography>
          </CardFooter>
        </Card>
      </div>

      {/* Floating animated elements */}
      <div className="absolute bottom-20 right-20 w-8 h-8 bg-primary/20 rounded-lg blur-[1px] animate-float"></div>
      <div className="absolute top-20 left-20 w-6 h-6 bg-indigo-500/20 rounded-full blur-[1px] animate-float-delayed"></div>
      <div className="absolute top-1/2 right-1/3 w-4 h-4 bg-blue-500/20 rounded-full blur-[1px] animate-float-slow"></div>
    </div>
  );
}

function BenefitItem({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 pl-1 group transition-all duration-300 hover:pl-2">
      <div className="flex-shrink-0 w-5 h-5 rounded-full bg-gradient-to-br from-green-500/30 to-green-500/10 flex items-center justify-center text-green-500 shadow-sm group-hover:from-green-500/40 group-hover:to-green-500/20 transition-all duration-300">
        <Check className="w-3 h-3" />
      </div>
      <Typography className="text-sm text-foreground/90 group-hover:text-foreground transition-all duration-300">
        {text}
      </Typography>
    </div>
  );
}
