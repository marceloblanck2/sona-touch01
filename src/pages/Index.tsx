// SØNA Pad v2 - Index Page

import { SonaPad } from '../components/sona/SonaPad';
import { Helmet } from 'react-helmet-async';

const Index = () => {
  return (
    <>
      <Helmet>
        <title>SØNA Pad v2 - Expressive Audio Instrument</title>
        <meta name="description" content="A modern, expressive, sensory instrument featuring multitouch expression, color-to-sound synesthesia, and emergent gesture behaviors based on Golden Ratio geometry and 432 Hz audio foundation." />
      </Helmet>
      <SonaPad />
    </>
  );
};

export default Index;
