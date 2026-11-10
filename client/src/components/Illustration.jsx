import React, { useState } from 'react';

// Shows /illustrations/<name>.png if one has been added. Otherwise the bundled
// <name>.svg outline is used as a mask and filled with the page color (--tone),
// so the drawings match whichever module they appear in.
const Illustration = ({ name, size = 140 }) => {
  const [hasPng, setHasPng] = useState(true);

  if (hasPng) {
    return (
      <img
        src={`/illustrations/${name}.png`}
        alt=""
        width={size}
        height={size}
        style={{ objectFit: 'contain', userSelect: 'none' }}
        draggable="false"
        onError={() => setHasPng(false)}
      />
    );
  }

  const mask = `url(/illustrations/${name}.svg) center / contain no-repeat`;
  return (
    <span
      className="illustration-outline"
      aria-hidden="true"
      style={{ width: size, height: size, WebkitMask: mask, mask }}
    />
  );
};

export default Illustration;
