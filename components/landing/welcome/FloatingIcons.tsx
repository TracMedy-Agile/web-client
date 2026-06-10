import Image from "next/image";
import icon_1 from "../../../public/icon-1.svg";
import icon_2 from "../../../public/icon-2.svg";
import icon_3 from "../../../public/icon-3.svg";
import icon_4 from "../../../public/icon-4.svg";

const icons = [
  { symbol: icon_1, top: "120px", left: "20%" },
  { symbol: icon_2, top: "140px", right: "20%" },
  { symbol: icon_3, top: "350px", left: "25%" },
  { symbol: icon_4, top: "355px", right: "25%" },
];

export default function FloatingIcons() {
  return (
    <div className="absolute inset-0 pointer-events-none z-1 hidden md:block">
      {icons.map((icon, i) => (
        <div
          key={i}
          className="absolute w-14 h-14 bg-white/70 rounded-l-3xl rounded-r-3xl  flex items-center justify-center shadow-sm"
          style={{ top: icon.top, left: icon.left, right: icon.right }}
        >
          <Image src={icon.symbol} alt="" width={28} height={28} />
          
        </div>
      ))}
    </div>
  );
}