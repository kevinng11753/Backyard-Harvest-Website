// Shown only after a grower accepts your request. This is the one
// place in the app where an exact address appears.
export default function PickupDetails({ grower, pickup }) {
  return (
    <div className="pickup">
      <p className="pickup-head">{grower} said yes</p>
      {pickup ? (
        <>
          <p className="pickup-address">{pickup.address}</p>
          {pickup.instructions && <p className="pickup-how">{pickup.instructions}</p>}
        </>
      ) : (
        <p className="pickup-how">Pickup details didn’t load. Close this and open it again.</p>
      )}
      <details className="safety">
        <summary>Pickup safety tips</summary>
        <ul>
          <li>Porch or curbside pickup works best. You don’t need to go inside.</li>
          <li>Go in daylight, and tell a family member where you’re going.</li>
          <li>Wash produce before eating it.</li>
        </ul>
      </details>
    </div>
  )
}
