// SØNA Touch 01 - Index Page

import { SonaPad } from '../components/sona/SonaPad';
import { Helmet } from 'react-helmet-async';

const Index = () => {
  return (
    <>
      <Helmet>
        <title>SØNA Touch 01 - Touch-Based Sensory Instrument</title>
        <meta name="description" content="SØNA Touch 01 is a modern, expressive, sensory instrument featuring multitouch expression, color-to-sound synesthesia, and emergent gesture behaviors based on Golden Ratio geometry and 432 Hz audio foundation." />
      </Helmet>
      <SonaPad />
    </>
  );
};

export default Index;
