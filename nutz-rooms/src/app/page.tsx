import Link from "next/link";
import Image from "next/image";

const CHARACTERS = [
  { id: "kagan", name: "Kagan", avatar: "/kagan-avatar.jpg" },
  { id: "steve-jobs", name: "Steve Jobs", avatar: "/steve-jobs-frame.jpg" },
  { id: "marc-andreessen", name: "Marc Andreessen", avatar: "/marc-avatar.jpg" },
  { id: "elon-musk", name: "Elon Musk", avatar: "/elon-avatar.jpg" },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold text-white mb-2">nutz rooms</h1>
      <p className="text-white/60 mb-12">Talk to the legends</p>

      <div className="flex gap-6">
        {CHARACTERS.map((character) => (
          <Link
            key={character.id}
            href={`/room/${character.id}`}
            className="group flex flex-col items-center gap-3"
          >
            <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-white/20 group-hover:border-white/60 transition-colors">
              <Image
                src={character.avatar}
                alt={character.name}
                width={96}
                height={96}
                className="w-full h-full object-cover"
              />
            </div>
            <span className="text-white/80 text-sm group-hover:text-white transition-colors">
              {character.name}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
