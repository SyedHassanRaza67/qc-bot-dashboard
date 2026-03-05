import { motion } from "framer-motion";
import { ArrowRight, Headphones, BarChart3, Brain, Shield, Check, Zap, Crown, Mail, MessageCircle, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeatureCard } from "@/components/FeatureCard";

import portfolio1 from "@/assets/portfolio/1.png";
import portfolio2 from "@/assets/portfolio/2.png";
import portfolio3 from "@/assets/portfolio/3.png";
import portfolio4 from "@/assets/portfolio/4.png";
import portfolio5 from "@/assets/portfolio/5.png";

const WHATSAPP_LINK = "https://wa.me/923109360056?text=Hi%2C%20I'm%20interested%20in%20Audio%20Analyzer%20AI";

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
  { value: "1M+", label: "Calls Analyzed" },
  { value: "99.9%", label: "Uptime" },
  { value: "50+", label: "Countries" },
];

const portfolioItems = [
  { src: portfolio1, title: "Dashboard Overview", description: "Real-time call analytics & KPIs" },
  { src: portfolio2, title: "Call Records", description: "Detailed call logs with transcriptions" },
  { src: portfolio3, title: "Call Detail View", description: "Deep-dive into individual calls" },
  { src: portfolio4, title: "Dialer Integrations", description: "VICIdial, Ringba & more" },
  { src: portfolio5, title: "Upload & Analysis", description: "AI-powered audio processing" },
];

const Home = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="min-h-screen flex items-center justify-center relative overflow-hidden pt-20">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-info/5" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-info/10 rounded-full blur-3xl" />

        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <h1 className="text-5xl md:text-7xl font-bold text-foreground mb-6 tracking-tight">
              Audio Analyzer AI
            </h1>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}>
            <p className="text-xl md:text-2xl text-primary font-medium mb-4">
              Empowering Businesses with Intelligent Voice Insights
            </p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-4">
              Upload calls, analyze automatically, and extract key details using AI.
              Transform your audio data into actionable business intelligence.
            </p>
            <p className="text-base text-muted-foreground max-w-2xl mx-auto mb-10">
              Custom integrations with <span className="text-primary font-semibold">VICIdial</span>, <span className="text-primary font-semibold">Ringba</span> & other dialers.{" "}
              <span className="text-primary font-semibold">Live Call QC</span> monitoring in real-time.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Button asChild size="lg" className="text-base px-8 py-6 rounded-xl">
              <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer">
                Get Started
                <ArrowRight className="ml-2 h-5 w-5" />
              </a>
            </Button>
            <Button asChild variant="outline" size="lg" className="text-base px-8 py-6 rounded-xl">
              <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="mr-2 h-5 w-5" />
                Book a Demo
              </a>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 px-6 bg-primary/5">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-3 gap-8">
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
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Powerful Features</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Everything you need to analyze and understand your audio recordings
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <FeatureCard key={feature.title} icon={feature.icon} title={feature.title} description={feature.description} delay={index * 0.1} />
            ))}
          </div>
        </div>
      </section>

      {/* Portfolio / Showcase Section */}
      <section className="py-24 px-6 bg-background">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">See It In Action</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Explore our powerful dashboard, analytics, and integrations built for call centers
            </p>
          </motion.div>

          {/* Top row: 2 large images */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {portfolioItems.slice(0, 2).map((item, index) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="group relative overflow-hidden rounded-2xl border border-border shadow-sm hover:shadow-xl transition-all duration-300"
              >
                <img src={item.src} alt={item.title} className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-6">
                  <div>
                    <h3 className="text-lg font-bold text-primary-foreground">{item.title}</h3>
                    <p className="text-sm text-primary-foreground/80">{item.description}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Bottom row: 3 images */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {portfolioItems.slice(2).map((item, index) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="group relative overflow-hidden rounded-2xl border border-border shadow-sm hover:shadow-xl transition-all duration-300"
              >
                <img src={item.src} alt={item.title} className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-6">
                  <div>
                    <h3 className="text-lg font-bold text-primary-foreground">{item.title}</h3>
                    <p className="text-sm text-primary-foreground/80">{item.description}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-24 px-6 bg-secondary/30">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Simple, Transparent Pricing</h2>
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
                  plan.popular ? "border-primary shadow-xl scale-105" : "border-border hover:border-primary/50"
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

                <Button asChild variant={plan.buttonVariant} className="w-full rounded-xl py-6">
                  <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer">
                    {plan.buttonText}
                  </a>
                </Button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-24 px-6 bg-background">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">How It Works</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Get started in just three simple steps</p>
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
                <div className="text-8xl font-bold text-primary/10 absolute top-0 left-1/2 -translate-x-1/2">{item.step}</div>
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

      {/* Contact / Book Demo Section */}
      <section className="py-24 px-6 bg-secondary/30">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Book a Free Demo</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-2">
              See how Audio Analyzer AI can revolutionize your call center operations with custom integrations for{" "}
              <span className="text-primary font-semibold">VICIdial</span>,{" "}
              <span className="text-primary font-semibold">Ringba</span>, and other leading dialers.
            </p>
            <p className="text-base text-muted-foreground max-w-2xl mx-auto">
              Get real-time <span className="font-semibold text-foreground">Live Call QC</span> monitoring, AI-powered transcription & sentiment analysis — all tailored to your workflow.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex flex-col sm:flex-row gap-6 justify-center items-center"
          >
            <a
              href="mailto:raxahassan67@gmail.com"
              className="flex items-center gap-3 bg-card border border-border rounded-2xl px-8 py-5 hover:border-primary/50 hover:shadow-lg transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <div className="text-left">
                <div className="text-sm text-muted-foreground">Email Us</div>
                <div className="font-semibold text-foreground">raxahassan67@gmail.com</div>
              </div>
            </a>

            <a
              href={WHATSAPP_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 bg-card border border-border rounded-2xl px-8 py-5 hover:border-success/50 hover:shadow-lg transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
                <Phone className="h-6 w-6 text-success" />
              </div>
              <div className="text-left">
                <div className="text-sm text-muted-foreground">WhatsApp</div>
                <div className="font-semibold text-foreground">+92 310 9360056</div>
              </div>
            </a>
          </motion.div>
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
              Join businesses already using Audio Analyzer AI for smarter call center operations
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="text-base px-8 py-6 rounded-xl">
                <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </a>
              </Button>
              <Button asChild variant="outline" size="lg" className="text-base px-8 py-6 rounded-xl">
                <a href="mailto:raxahassan67@gmail.com">
                  <Mail className="mr-2 h-5 w-5" />
                  Email Us
                </a>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default Home;
