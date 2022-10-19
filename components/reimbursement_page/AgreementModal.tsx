import Button from "components/Button"
import Loading from "components/Loading"
import Modal from "components/Modal"

const AgreementModal = ({
  isOpen,
  onClose,
  onAggree,
  isLoading,
}: {
  isOpen: boolean
  onClose?: (x) => void
  onAggree: () => void
  isLoading: boolean
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
        <Button disabled={isLoading} className="mt-2 px-8" onClick={onAggree}>
          {isLoading ? <Loading></Loading> : "I Agree"}
        </Button>
      </div>
    </Modal>
  )
}

export default AgreementModal
