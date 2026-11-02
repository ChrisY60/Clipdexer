import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  AudioLines,
  Eye,
  Search,
  Upload,
} from "lucide-react";

export const metadata: Metadata = {
  title: "About Clipdexer | Find the moment",
  description: "A searchable archive for the moments hiding inside your clips.",
};

export default function AboutPage() {
  return (
    <main className="about-page">
      <a className="skip-link" href="#about-content">
        Skip to content
      </a>
      <header className="about-masthead">
        <Link className="about-wordmark" href="/" aria-label="Clipdexer home">
          clipdexer<span>.</span>
        </Link>
        <nav aria-label="Main navigation">
          <Link href="/">Discover</Link>
          <Link href="/?view=library">Clip library</Link>
          <Link href="/#search-desk">Search</Link>
          <Link className="about-active" href="/about" aria-current="page">
            About
          </Link>
        </nav>
      </header>
      <div className="about-topline">
        <span>AN INDEX FOR THE INTERNET’S LOST MOMENTS</span>
        <span>NO. 01 / ABOUT</span>
      </div>
      <article id="about-content">
        <section className="about-hero">
          <div>
            <p className="about-overline">THE MEMORY IS THERE. SOMEWHERE.</p>
            <h1>
              Find the moment
              <br />
              inside the <em>memory.</em>
            </h1>
            <p className="about-lede">
              Clipdexer turns clips into a searchable archive, so a
              half-remembered sentence, a glimpse, or a tiny detail can lead you
              back to the exact moment.
            </p>
            <Link className="about-cta" href="/?action=upload">
              Bring in a clip <ArrowRight size={17} />
            </Link>
          </div>
          <figure className="about-figure">
            <img
              src="/identity/memory-loop.svg"
              alt="A hand-drawn film loop, folded back into itself."
            />
            <figcaption>THE MOMENT WAS NEVER REALLY LOST.</figcaption>
          </figure>
        </section>

        <section className="about-method" aria-labelledby="method-title">
          <div className="about-section-heading">
            <h2 id="method-title">
              A&nbsp;memory,
              <br />
              indexed.
            </h2>
            <p>
              Each clip is processed once. Later, search works from the saved
              index.
            </p>
          </div>
          <div className="about-steps">
            <section>
              <span className="step-number">01</span>
              <Upload size={20} />
              <h3>Bring it in</h3>
              <p>
                Upload a clip manually or connect your Twitch account and import
                clips you are authorized to access.
              </p>
            </section>
            <section>
              <span className="step-number">02</span>
              <AudioLines size={20} />
              <h3>Make it searchable</h3>
              <p>
                AI indexes timestamped speech and describes what is visible, so
                both can be searched later.
              </p>
            </section>
            <section>
              <span className="step-number">03</span>
              <Search size={20} />
              <h3>Find your way back</h3>
              <p>
                Describe what you remember. See the matching moment, the
                timestamp, and the evidence behind the result.
              </p>
            </section>
          </div>
        </section>

        <section className="about-evidence">
          <div>
            <Eye size={20} />
            <p>
              Search follows the content inside a clip, including words spoken
              and visual details. If the evidence is weak, Clipdexer says so.
            </p>
          </div>
          <div>
            <AudioLines size={20} />
            <p>
              The index keeps its timestamps, so a match can take you straight
              to the relevant moment.
            </p>
          </div>
        </section>

        <section className="about-bottom">
          <p>LESS SCROLLING. MORE “THAT’S THE ONE.”</p>
          <h2>
            Ready when
            <br />
            memory <em>isn’t.</em>
          </h2>
          <div>
            <Link href="/#search-desk">
              Search your archive <ArrowRight size={16} />
            </Link>
            <Link href="/?action=upload">
              Add your first clip <ArrowRight size={16} />
            </Link>
            <Link href="/">
              Back to Clipdexer <ArrowLeft size={16} />
            </Link>
          </div>
        </section>
      </article>
      <footer className="about-footer">
        <Link href="/">
          clipdexer<span>.</span>
        </Link>
        <span>KEEP THE MOMENT. LOSE THE SCROLL.</span>
      </footer>
    </main>
  );
}
