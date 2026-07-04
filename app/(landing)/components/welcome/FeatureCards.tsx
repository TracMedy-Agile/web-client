import Image from "next/image";
import icon_1 from "../../../../public/dashboard_icon.svg";
import icon_2 from "../../../../public/trend_icon.svg";
import icon_3 from "../../../../public/boorkmark_icon.svg";
import icon_4 from "../../../../public/warning_icon.svg";

const cards = [
  {
    title: "Command Center",
    description:
      "Real-time overview of active patient recovery trends and urgent clinical priorities.",
    icon: icon_1,
    bg: "bg-blue-50",
    iconColor: "text-primary",
  },
  {
    title: "Outcome Reports",
    description:
      "Track hospital performance, readmission rates, and recovery success metrics.",
    icon: icon_2,
    bg: "bg-green-50",
    iconColor: "text-green-700",
  },
  {
    title: "Patient Monitoring",
    description:
      "Monitor patient recovery progress and vital health updates in real time.",
    icon: icon_3,
    bg: "bg-teal-50",
    iconColor: "text-teal-700",
  },
  {
    title: "Case Management",
    description:
      "Review active alerts, and document clinician resolutions in one place.",
    icon: icon_4,
    bg: "bg-red-50",
    iconColor: "text-red-500",
  },
];

export default function FeatureCards() {
  return (
    <section className="relative z-3 px-7 mt-8 mb-10">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
        {cards.map((card) => (
          <div
            key={card.title}
            className="bg-white/90 rounded-2xl p-6 border border-white/60"
          >
            <div
              className={`w-10 h-10 ${card.bg} rounded-xl flex items-center justify-center text-xl ${card.iconColor} mb-4`}
            >
               <Image src={card.icon} alt="" width={20} height={20} />
            </div>
            <h3 className="text-base font-bold text-[#0d1f4a] mb-2">
              {card.title}
            </h3>
            <p className="text-sm text-[#5a6a80] leading-relaxed">
              {card.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
