import Image from "next/image";


export default function Navbar() {
  return (
    <nav className="flex items-center px-9 py-5 relative z-10">
      <div className="flex items-center gap-2.5">
        
        <Image   src="/tracmedy_logo.svg"
          alt="Tracmedy Logo"
          width={40}
          height={40}
        />
        
        <span className="font-bold text-lg tracking-widest text-primary">
          TRACMEDY
        </span>
      </div>
    </nav>
  );
}