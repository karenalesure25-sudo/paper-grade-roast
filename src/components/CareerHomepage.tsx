import { useState, useRef } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Check,
  FileText,
  Linkedin,
  MessagesSquare,
  Compass,
  Sparkles,
  ShieldCheck,
  Menu,
  X,
  Target,
} from "lucide-react";
import { BrandLogo } from "./BrandLogo";

const navigation = [
  ["AI Career Tools", "#career-ai"],
  ["Resume Services", "#services"],
  ["LinkedIn", "#linkedin"],
  ["Interview Prep", "#interview"],
  ["Pricing", "#services"],
  ["About", "#about"],
];
export function CareerHeader() {
  const [open, setOpen] = useState(false);
  const signIn = useRef<HTMLDialogElement>(null);
  return (
    <header className="clarity-header-wrap">
      <div className="clarity-nav glass-surface">
        <Link to="/" aria-label="Kay’s Career Solutions home" className="clarity-logo">
          <BrandLogo compact />
        </Link>
        <nav aria-label="Main navigation" className="clarity-desktop-nav">
          {navigation.map(([name, href]) => (
            <a key={name} href={href}>
              {name}
            </a>
          ))}
        </nav>
        <div className="clarity-nav-actions">
          <button className="clarity-signin" onClick={() => signIn.current?.showModal()}>
            Sign In
          </button>
          <Link to="/roast" className="clarity-button">
            Start Free <ArrowRight size={16} />
          </Link>
          <button
            className="clarity-menu"
            aria-label={open ? "Close navigation" : "Open navigation"}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>
      {open && (
        <nav className="clarity-mobile-nav glass-surface" aria-label="Mobile navigation">
          {navigation.map(([name, href]) => (
            <a key={name} href={href} onClick={() => setOpen(false)}>
              {name}
            </a>
          ))}
        </nav>
      )}
      <dialog ref={signIn} aria-labelledby="signin-heading" className="glass-surface clarity-modal">
        <button
          autoFocus
          className="clarity-modal-close"
          onClick={() => signIn.current?.close()}
          aria-label="Close sign in information"
        >
          <X />
        </button>
        <p className="clarity-eyebrow">No account needed</p>
        <h2 id="signin-heading">Your next step starts here.</h2>
        <p>
          Account sign-in isn’t available yet. Start your free résumé review without an account.
          Already purchased? Use the private order link provided after checkout.
        </p>
        <button
          className="clarity-button"
          onClick={() => {
            signIn.current?.close();
            window.location.href = "/roast";
          }}
        >
          Start Free <ArrowRight size={16} />
        </button>
      </dialog>
    </header>
  );
}
const actions = [
  { icon: FileText, label: "Improve my resume", href: "/roast" },
  { icon: Target, label: "Tailor to a job", href: "/order/bundle" },
  { icon: Linkedin, label: "Optimize my LinkedIn", href: "#linkedin" },
  { icon: MessagesSquare, label: "Prepare for an interview", href: "#interview" },
];
function CareerPanel({ expanded = false }: { expanded?: boolean }) {
  return (
    <div className={`career-panel glass-surface ${expanded ? "career-panel-expanded" : ""}`}>
      <div className="career-panel-heading">
        <img src="/brand/kcs-emblem.svg" alt="" width="42" height="50" />
        <div>
          <h3>Career Clarity AI</h3>
          <p>Your personal career strategist.</p>
        </div>
        <span className="preview-pill">Preview</span>
      </div>
      {expanded && (
        <>
          <div className="career-context">
            <span>
              <FileText size={14} /> Resume
            </span>
            <span>
              <Compass size={14} /> Career goals
            </span>
            <span>
              <Target size={14} /> Target positions
            </span>
          </div>
          <div className="career-chat">
            <span className="clarity-eyebrow">Example conversation</span>
            <p>I’m ready for my next role. Where should I focus?</p>
            <div>
              <Sparkles size={18} />
              <p>
                Start with the experience you already have. Clarify your strongest contributions,
                then connect them to the requirements of your target role.
              </p>
            </div>
          </div>
        </>
      )}
      <div className="career-prompt">
        <span>How can I help you with your career goals today?</span>
        <a href="/roast" aria-label="Start a free résumé review">
          <ArrowRight size={20} />
        </a>
      </div>
      <div className="career-quick-actions">
        {actions.map(({ icon: Icon, label, href }) => (
          <a href={href} key={label}>
            <Icon size={17} />
            {label}
          </a>
        ))}
      </div>
      {expanded && (
        <p className="career-preview-note">
          Concept preview. Saved jobs, persistent career context, LinkedIn tools, and interview
          coaching are planned. Try the free résumé review today.
        </p>
      )}
    </div>
  );
}
export function ClarityHero() {
  return (
    <section className="clarity-hero clarity-shell">
      <div className="clarity-hero-copy">
        <p className="clarity-eyebrow">AI-powered career support + expert guidance</p>
        <h1>
          Career Clarity
          <br />
          <span>for What’s Next.</span>
        </h1>
        <p className="clarity-intro">
          Build a stronger resume, sharpen your professional brand, prepare for interviews, and make
          your next career move with AI-powered guidance and expert support when you need it.
        </p>
        <div className="clarity-hero-actions">
          <Link to="/roast" className="clarity-button">
            Start Free <ArrowRight size={18} />
          </Link>
          <a href="#services" className="clarity-outline">
            Explore Services
          </a>
        </div>
        <div className="clarity-trust">
          <span>
            <Check size={15} /> Free résumé review
          </span>
          <span>
            <ShieldCheck size={15} /> No account needed
          </span>
          <span>
            <FileText size={15} /> Services from $40
          </span>
        </div>
        <p className="clarity-availability">
          Start with résumé support today. More career tools are on the way.
        </p>
      </div>
      <div className="clarity-product-art">
        <svg className="career-ribbon-art" viewBox="0 0 760 620" fill="none" aria-hidden="true">
          <defs>
            <linearGradient
              id="career-cyan-fold"
              x1="190"
              y1="40"
              x2="440"
              y2="410"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#77fff0" />
              <stop offset=".3" stopColor="#22bddd" />
              <stop offset=".7" stopColor="#275cbb" />
              <stop offset="1" stopColor="#161d48" />
            </linearGradient>
            <linearGradient
              id="career-indigo-fold"
              x1="170"
              y1="320"
              x2="680"
              y2="555"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#123765" />
              <stop offset=".4" stopColor="#455ce4" />
              <stop offset=".75" stopColor="#9784ed" />
              <stop offset="1" stopColor="#313275" />
            </linearGradient>
            <linearGradient
              id="career-upper-fold"
              x1="630"
              y1="0"
              x2="500"
              y2="340"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#a28bfa" />
              <stop offset=".55" stopColor="#4c59ce" />
              <stop offset="1" stopColor="#223c72" />
            </linearGradient>
          </defs>
          <path
            d="M750 0C566 17 546 116 438 189L505 299C607 228 666 119 760 69Z"
            fill="url(#career-upper-fold)"
          />
          <path
            d="M640 149C480 29 278 9 176 121C59 249 130 362 275 391C155 296 244 192 350 176C459 158 545 173 640 149Z"
            fill="url(#career-cyan-fold)"
          />
          <path
            d="M176 121C67 218 53 328 152 409C256 494 433 497 485 620L665 620C557 403 288 454 191 331C142 269 139 192 176 121Z"
            fill="url(#career-indigo-fold)"
          />
          <path
            d="M176 121C278 9 480 29 640 149M152 409C256 494 433 497 485 620"
            stroke="#bdffff"
            strokeOpacity=".32"
            strokeWidth="1.5"
          />
        </svg>
        <CareerPanel />
        <div className="career-snapshot glass-surface">
          <p>
            Your Career Snapshot <span>Example</span>
          </p>
          <div className="snapshot-score">
            <div>
              85<span>%</span>
            </div>
            <p>
              Job Alignment<strong>Strong match</strong>
            </p>
          </div>
          <ul>
            {["Key strengths", "Optimization opportunities", "Recommended next steps"].map(
              (text) => (
                <li key={text}>
                  <Check size={14} />
                  {text}
                </li>
              ),
            )}
          </ul>
          <small>Illustrative score, not a measured result.</small>
        </div>
      </div>
    </section>
  );
}
const services = [
  {
    id: "resume-writing",
    icon: FileText,
    title: "Resume Writing",
    copy: "Strategic, modern resumes that get you noticed.",
    href: "#services",
    available: true,
  },
  {
    id: "linkedin",
    icon: Linkedin,
    title: "LinkedIn Branding",
    copy: "A standout professional presence that opens doors.",
  },
  {
    id: "interview",
    icon: MessagesSquare,
    title: "Interview Prep",
    copy: "Build confidence. Communicate with impact. Land the role.",
  },
  {
    id: "career-strategy",
    icon: Compass,
    title: "Career Strategy",
    copy: "Personalized guidance for your next move.",
  },
];
export function CareerServices() {
  return (
    <section className="clarity-shell clarity-services" aria-label="Career services">
      <div className="clarity-service-grid">
        {services.map(({ id, icon: Icon, title, copy, href, available }) => (
          <article id={id} key={id} className="glass-surface clarity-service-card">
            <div className="clarity-service-icon">
              <Icon size={27} />
            </div>
            <div>
              <h2>{title}</h2>
              <p>{copy}</p>
              {available ? (
                <a
                  href={href}
                  className="service-arrow"
                  aria-label="Explore résumé writing services"
                >
                  <ArrowRight size={19} />
                </a>
              ) : (
                <span className="coming-label">
                  Coming soon <ArrowRight size={14} />
                </span>
              )}
            </div>
          </article>
        ))}
      </div>
      <div className="clarity-value-strip">
        {[
          ["Polish your story", "Clarify your experience and communicate your value."],
          ["Optimize your opportunities", "Strengthen how employers discover and evaluate you."],
          [
            "Elevate your tomorrow",
            "Position yourself for the next role, promotion, or career move.",
          ],
        ].map(([title, body]) => (
          <div key={title}>
            <h3>{title}</h3>
            <p>{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
export function CareerShowcase() {
  return (
    <section id="career-ai" className="clarity-showcase clarity-shell">
      <div>
        <p className="clarity-eyebrow">Introducing the next chapter · In development</p>
        <h2>Your career strategy shouldn’t start from scratch every time.</h2>
        <p>
          We’re shaping Career Clarity AI around your whole story: your resume, experience, career
          goals, target positions, saved jobs, and prior work.
        </p>
        <p>
          One connected perspective. More focused next steps. While that experience is in
          development, get useful feedback on the résumé you have today.
        </p>
        <Link to="/roast" className="clarity-button">
          Try the Free Resume Review <ArrowRight size={17} />
        </Link>
      </div>
      <CareerPanel expanded />
    </section>
  );
}
export function CareerStatement() {
  return (
    <section id="about" className="clarity-statement">
      <div className="clarity-shell">
        <p className="clarity-eyebrow">The Kay’s approach</p>
        <h2>
          Your experience has value.
          <br />
          <em>Let’s make it clear.</em>
        </h2>
        <div>
          <span className="statement-line" />
          <p>
            Better career storytelling starts with what’s true. We help you turn your real
            experience into a clearer, stronger professional story—without inventing achievements or
            promising outcomes.
          </p>
        </div>
      </div>
    </section>
  );
}
