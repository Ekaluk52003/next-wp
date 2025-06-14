// Craft Imports
import { Section, Container, Prose } from "@/components/craft";
import Balancer from "react-wrap-balancer";

// Next.js Imports
import Link from "next/link";

// Icons
import { File, Pen, Tag, Diamond, User, Folder } from "lucide-react";


// This page is using the craft.tsx component and design system
export default function Home() {
  return (
    <Section>
      <Container>
        <ToDelete />
      </Container>
    </Section>
  );
}

// This is just some example TSX
const ToDelete = () => {
  return (
    <main className="space-y-6">
      <Prose>
        <h1>
          <Balancer>प्रार्थना: The Art of Prayer in Hindi</Balancer>
        </h1>

        <p>
          Welcome to our comprehensive guide on Hindi prayers and spiritual practices.
          Here you will find traditional <a href="/mantras">mantras</a>,
          <a href="/techniques">meditation techniques</a>, and
          <a href="/daily-prayers">daily prayer routines</a> that have been
          practiced for centuries across India. Our resources are designed to help both
          beginners and experienced practitioners deepen their spiritual connection through
          the beautiful language of Hindi. Explore our collection of
          <a href="/audio">audio recordings</a> and <a href="/translations">translations</a>
          to enhance your prayer experience.
        </p>
      </Prose>


      <div className="grid md:grid-cols-3 gap-4 mt-6">
        <Link
          className="border h-48 bg-accent/50 rounded-lg p-4 flex flex-col justify-between hover:scale-[1.02] transition-all"
          href="/posts"
        >
          <Pen size={32} />
          <span>
            Posts{" "}
            <span className="block text-sm text-muted-foreground">
              All articles
            </span>
          </span>
        </Link>
   
        <Link
          className="border h-48 bg-accent/50 rounded-lg p-4 flex flex-col justify-between hover:scale-[1.02] transition-all"
          href="/posts/authors"
        >
          <User size={32} />
          <span>
            Authors{" "}
            <span className="block text-sm text-muted-foreground">
              Our Author
            </span>
          </span>
        </Link>
        <Link
          className="border h-48 bg-accent/50 rounded-lg p-4 flex flex-col justify-between hover:scale-[1.02] transition-all"
          href="/posts/tags"
        >
          <Tag size={32} />
          <span>
            Tags{" "}
            <span className="block text-sm text-muted-foreground">
              Our Tags
            </span>
          </span>
        </Link>
        <Link
          className="border h-48 bg-accent/50 rounded-lg p-4 flex flex-col justify-between hover:scale-[1.02] transition-all"
          href="/posts/categories"
        >
          <Diamond size={32} />
          <span>
            Categories{" "}
            <span className="block text-sm text-muted-foreground">
              Our Categories
            </span>
          </span>
        </Link>
      
      </div>
    </main>
  );
};
