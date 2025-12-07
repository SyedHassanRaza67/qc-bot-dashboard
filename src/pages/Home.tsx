import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Headphones, BarChart3, Brain, Shield, Check, Zap, Users, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeatureCard } from "@/components/FeatureCard";

const features = [
  {
    icon: Headphones,
    title: "Audio-to-Text",
    description: "Convert your audio recordings to accurate text transcriptions using advanced AI technology.",
  },
  {
    icon: BarChart3,
    title: "Smart Insights",
    description: "Extract meaningful data and analytics from your call recordings automatically.",
  },
  {
    icon: Brain,
    title: "Sentiment Analysis",
    description: "Understand customer emotions and call outcomes with AI-powered sentiment detection.",
  },
  {
    icon: Shield,
    title: "Secure Storage",
    description: "Your audio files and transcriptions are encrypted and stored securely in the cloud.",
  },
];

const pricingPlans = [
  {
    name: "Starter",
    price: "Free",
    description: "Perfect for trying out our service",
    features: [
      "5 audio uploads per month",
      "Basic transcription",
      "Email support",
      "1GB storage",
    ],
    popular: false,
    buttonText: "Get Started",
    buttonVariant: "outline" as const,
  },
  {
    name: "Professional",
    price: "$29",
    period: "/month",
    description: "Best for growing businesses",
    features: [
      "100 audio uploads per month",
      "Advanced AI analysis",
      "Priority support",
      "25GB storage",
      "Custom reports",
      "API access",
    ],
    popular: true,
    buttonText: "Start Free Trial",
    buttonVariant: "default" as const,
  },
  {
    name: "Enterprise",
    price: "$99",
    period: "/month",
    description: "For large organizations",
    features: [
      "Unlimited uploads",
      "Advanced analytics dashboard",
      "24/7 dedicated support",
      "Unlimited storage",
      "Custom integrations",
      "White-label options",
      "Team management",
    ],
    popular: false,
    buttonText: "Contact Sales",
    buttonVariant: "outline" as const,
  },
];

const stats = [
  { value: "10K+", label: "Active Users" },
  { value: "1M+", label: "Calls Analyzed" },
  { value: "99.9%", label: "Uptime" },
  { value: "50+", label: "Countries" },
];

const Home = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="min-h-screen flex items-center justify-center relative overflow-hidden pt-20">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-info/5" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-info/10 rounded-full blur-3xl" />

        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-5xl md:text-7xl font-bold text-foreground mb-6 tracking-tight">
              AI Audio Analyzer
            </h1>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <p className="text-xl md:text-2xl text-primary font-medium mb-4">
              Empowering Businesses with Intelligent Voice Insights
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10">
              Upload calls, analyze automatically, and extract key details using AI. 
              Transform your audio data into actionable business intelligence.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Button asChild size="lg" className="text-base px-8 py-6 rounded-xl">
              <Link to="/upload">
                Get Started
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="text-base px-8 py-6 rounded-xl">
              <Link to="/auth">Sign In</Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 px-6 bg-primary/5">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="text-center"
              >
                <div className="text-4xl md:text-5xl font-bold text-primary mb-2">{stat.value}</div>
                <div className="text-muted-foreground">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-6 bg-secondary/30">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Powerful Features
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Everything you need to analyze and understand your audio recordings
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <FeatureCard
                key={feature.title}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
                delay={index * 0.1}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-24 px-6 bg-background">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Choose the plan that best fits your needs. Start free and scale as you grow.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {pricingPlans.map((plan, index) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className={`relative bg-card border rounded-2xl p-8 ${
                  plan.popular 
                    ? 'border-primary shadow-xl scale-105' 
                    : 'border-border hover:border-primary/50'
                } transition-all duration-300`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium flex items-center gap-1">
                      <Crown className="h-4 w-4" /> Most Popular
                    </span>
                  </div>
                )}

                <div className="text-center mb-8">
                  <h3 className="text-xl font-bold text-foreground mb-2">{plan.name}</h3>
                  <p className="text-muted-foreground text-sm mb-4">{plan.description}</p>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                    {plan.period && <span className="text-muted-foreground">{plan.period}</span>}
                  </div>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-3">
                      <Check className="h-5 w-5 text-success flex-shrink-0" />
                      <span className="text-foreground text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  asChild
                  variant={plan.buttonVariant}
                  className="w-full rounded-xl py-6"
                >
                  <Link to="/auth">{plan.buttonText}</Link>
                </Button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-24 px-6 bg-secondary/30">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              How It Works
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Get started in just three simple steps
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: "01", icon: Zap, title: "Upload Audio", desc: "Drag and drop your audio files or record directly" },
              { step: "02", icon: Brain, title: "AI Analysis", desc: "Our AI transcribes and analyzes your content" },
              { step: "03", icon: BarChart3, title: "Get Insights", desc: "Review detailed insights and actionable data" },
            ].map((item, index) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="relative text-center p-8"
              >
                <div className="text-8xl font-bold text-primary/10 absolute top-0 left-1/2 -translate-x-1/2">
                  {item.step}
                </div>
                <div className="relative z-10 pt-8">
                  <div className="w-16 h-16 mx-auto mb-6 bg-primary/10 rounded-2xl flex items-center justify-center">
                    <item.icon className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-2">{item.title}</h3>
                  <p className="text-muted-foreground">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 bg-primary/10">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Ready to Transform Your Audio Data?
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Join thousands of businesses already using AI Audio Analyzer
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="text-base px-8 py-6 rounded-xl">
                <Link to="/auth">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="text-base px-8 py-6 rounded-xl">
                <Link to="/dashboard">View Demo</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default Home;
