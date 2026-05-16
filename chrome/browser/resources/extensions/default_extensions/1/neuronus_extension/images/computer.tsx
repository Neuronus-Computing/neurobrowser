import React from "react";

const Computer = ({ className = "" }) => {
  return (
    <svg
      width="42"
      height="42"
      viewBox="0 0 42 42"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M37.127 1.16249H4.43199C2.62629 1.16249 1.16249 2.62629 1.16249 4.43199V28.4083C1.16249 30.214 2.62629 31.6778 4.43199 31.6778H37.127C38.9327 31.6778 40.3965 30.214 40.3965 28.4083V4.43199C40.3965 2.62629 38.9327 1.16249 37.127 1.16249Z"
        stroke="black"
        stroke-width="2.32498"
        stroke-linejoin="round"
      />
      <path
        d="M10.0687 40.3965H31.8653M20.967 31.6778V40.3965"
        stroke="black"
        stroke-width="2.32498"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M14.8321 23.015L19.8168 9.99516H22.1604L27.0708 23.015H25.6572L24.4296 19.7787H17.5105L16.2271 23.015H14.8321ZM17.9383 18.5511H24.0018L20.9886 10.4602L17.9383 18.5511Z"
        fill="#1E2330"
      />
    </svg>
  );
};

export default Computer;
