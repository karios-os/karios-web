import * as React from "react";

const AnthosIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    version="1.1"
    id="Layer_1"
    xmlns="http://www.w3.org/2000/svg"
    xmlnsXlink="http://www.w3.org/1999/xlink"
    x="0px"
    y="0px"
    width="24px"
    height="24px"
    viewBox="0 0 24 24"
    style={{ enableBackground: "new 0 0 24 24" } as React.CSSProperties}
    xmlSpace="preserve"
    {...props}
  >
    <style type="text/css">
      {`
        .st0{fill:#FEBC00;}
        .st1{fill:#EE3C2B;}
        .st2{fill:#2BAA4F;}
        .st3{fill:#3982F8;}
      `}
    </style>
    <polygon
      className="st0"
      points="6,15.8 12,5.3 18,15.8 23,20.8 23.2,21 23.2,21 12,1.6 0.8,21 0.8,21 1,20.8"
    />
    <g>
      <g>
        <polygon
          className="st1"
          points="12,9.7 1,20.8 5.6,18.7 12,12.3 18.4,18.7 23,20.8"
        />
      </g>
    </g>
    <polygon className="st2" points="6,20.6 1.8,22.4 22.2,22.4 18,20.6" />
    <polygon
      className="st3"
      points="23,20.8 12,15.8 1,20.8 0,22.4 1.8,22.4 12,17.8 22.2,22.4 24,22.4"
    />
  </svg>
);

export default AnthosIcon;
