import Button from "components/Button"
import Modal from "components/Modal"
import { ElementTitle } from "components/styles"

const AgreementModal = ({
  isOpen,
  onClose,
  onAggree,
}: {
  isOpen: boolean
  onClose?: (x) => void
  onAggree: () => void
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      {/* <Modal.Header>
        <ElementTitle noMarginBottom>Agreement</ElementTitle>
      </Modal.Header> */}
      <div className="space-y-2">
        <div className="flex items-center justify-center pb-4 text-th-fgd-3">
          By clicking “I Agree” and claiming these tokens, I understand and
          manifest my assent and agreement to be bound by this enforceable
          contract, and agree that all claims under this agreement will be
          resolved exclusively under the laws of the State of New York.
        </div>
      </div>
      <div className="flex justify-center">
        <Button className="mt-2 px-8" onClick={onAggree}>
          I Agree
        </Button>
      </div>
    </Modal>
  )
}

export default AgreementModal
