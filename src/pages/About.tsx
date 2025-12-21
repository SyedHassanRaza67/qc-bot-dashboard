import { motion } from "framer-motion";
import { AudioWaveform, Users, GraduationCap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const About = () => {
  return (
    <div className="min-h-screen bg-background pt-24 pb-16 px-6">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <AudioWaveform className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-4">
            About Audio Analyzer AI
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            A powerful tool for transforming audio recordings into actionable insights
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Card className="rounded-2xl mb-8">
            <CardContent className="p-8">
              <p className="text-lg text-foreground leading-relaxed mb-6">
                Audio Analyzer AI is an intelligent platform designed to help businesses 
                analyze their call recordings efficiently. Using advanced AI technology, 
                we automatically transcribe audio files, extract key information, and 
                provide actionable insights that help improve customer interactions 
                and business outcomes.
              </p>
              <p className="text-lg text-foreground leading-relaxed">
                Our platform leverages cutting-edge speech recognition and natural 
                language processing to identify call outcomes, sentiment, and important 
                details from every conversation. Whether you're tracking sales calls, 
                customer support interactions, or general business communications, 
                Audio Analyzer AI makes it easy to understand and act on your audio data.
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Card className="rounded-2xl h-full">
              <CardContent className="p-8">
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-5">
                  <Users className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-3">
                  Developed By
                </h3>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="text-lg">Syed Hassan Raza</li>
                  <li className="text-lg">Sibtain Ali</li>
                </ul>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Card className="rounded-2xl h-full">
              <CardContent className="p-8">
                <div className="w-14 h-14 rounded-xl bg-info/10 flex items-center justify-center mb-5">
                  <GraduationCap className="h-7 w-7 text-info" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-3">
                  Supervised By
                </h3>
                <p className="text-lg text-muted-foreground">
                  Mr. Muhammad Aqib Rauf
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default About;
